"""Shared Blender 4.5 geometry, PBR material, animation, glTF export, and Cycles icon utilities."""

import math
import os
import bpy
import bmesh
import numpy as np
from mathutils import Euler, Matrix, Quaternion, Vector


def reset_scene():
    """Clear everything for a clean deterministic build."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = 30
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0


def g2b(x: float, y: float, z: float) -> Vector:
    """Convert glTF (+X right, +Y up, -Z forward) to Blender (+X right, +Y forward, +Z up).
    With export_yup=True, Blender (bx, by, bz) exports as glTF (bx, bz, -by).
    Therefore (x, -z, y) in Blender exports to exact (x, y, z) in glTF.
    """
    return Vector((x, -z, y))


def gltf_quat_to_blender_quat(qx: float, qy: float, qz: float, qw: float) -> Quaternion:
    """Convert glTF quaternion (x, y, z, w) to Blender Quaternion(w, x, y, z) for export_yup=True."""
    # Axis mapping g2b: (gx, gy, gz) -> (gx, -gz, gy)
    return Quaternion((qw, qx, -qz, qy)).normalized()


def gltf_euler_yzx_to_blender_quat(rx: float, ry: float, rz: float) -> Quaternion:
    """Match original character-builder eulerYzxToQuat(rx, ry, rz) in Blender space."""
    cx, sx = math.cos(rx * 0.5), math.sin(rx * 0.5)
    cy, sy = math.cos(ry * 0.5), math.sin(ry * 0.5)
    cz, sz = math.cos(rz * 0.5), math.sin(rz * 0.5)
    qx = sx * cy * cz + cx * sy * sz
    qy = cx * sy * cz - sx * cy * sz
    qz = cx * cy * sz + sx * sy * cz
    qw = cx * cy * cz - sx * sy * sz
    return gltf_quat_to_blender_quat(qx, qy, qz, qw)


def gltf_axis_angle_to_blender_quat(ax: float, ay: float, az: float, rad: float) -> Quaternion:
    axis = g2b(ax, ay, az)
    if axis.length < 1e-8:
        return Quaternion((1, 0, 0, 0))
    return Quaternion(axis.normalized(), rad)


def link_obj(obj, parent=None):
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def make_empty(name: str, gltf_loc=(0.0, 0.0, 0.0), parent=None, gltf_quat=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_size = 0.2
    obj.location = g2b(*gltf_loc)
    obj.rotation_mode = 'QUATERNION'
    if gltf_quat is not None:
        obj.rotation_quaternion = gltf_quat
    link_obj(obj, parent)
    return obj


def srgb_to_linear(c: float) -> float:
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def rgb_lin(rgb):
    return (srgb_to_linear(rgb[0]), srgb_to_linear(rgb[1]), srgb_to_linear(rgb[2]), 1.0)


def make_pbr_mat(
    name: str,
    color=(0.8, 0.8, 0.8),
    metallic=0.0,
    roughness=0.5,
    emissive=None,
    emissive_strength=1.0,
    coat=0.0,
    coat_roughness=0.12,
    alpha=1.0,
    double_sided=False,
    specular=0.5,
):
    """Create a glTF-exportable Principled BSDF PBR material."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    mat.use_backface_culling = not double_sided
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    if bsdf is None:
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")

    bsdf.inputs["Base Color"].default_value = (color[0], color[1], color[2], 1.0)
    bsdf.inputs["Metallic"].default_value = float(metallic)
    bsdf.inputs["Roughness"].default_value = float(roughness)
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = float(specular)
    # Use crisp glossy roughness on MeshStandardMaterial instead of heavy KHR_materials_clearcoat
    if coat > 0.0:
        bsdf.inputs["Roughness"].default_value = max(0.10, float(roughness) * (1.0 - coat * 0.25))
    if emissive is not None:
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (emissive[0], emissive[1], emissive[2], 1.0)
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = float(emissive_strength)
    if alpha < 0.999:
        bsdf.inputs["Alpha"].default_value = float(alpha)
        mat.blend_method = 'BLEND'
    return mat


def make_image_mat(
    name: str,
    img_path: str,
    color_tint=(1.0, 1.0, 1.0),
    metallic=0.0,
    roughness=0.7,
    roughness_img_path=None,
    emissive=None,
    emissive_strength=0.0,
    coat=0.0,
    double_sided=False,
):
    """Create a glTF-exportable textured PBR material backed by an external image file."""
    mat = make_pbr_mat(
        name,
        color=color_tint,
        metallic=metallic,
        roughness=roughness,
        emissive=emissive,
        emissive_strength=emissive_strength,
        coat=coat,
        double_sided=double_sided,
    )
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")

    tex_node = nt.nodes.new("ShaderNodeTexImage")
    img = bpy.data.images.load(img_path, check_existing=True)
    img.pack()
    tex_node.image = img

    if color_tint != (1.0, 1.0, 1.0):
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs["Factor"].default_value = 1.0
        mix.inputs["B"].default_value = (color_tint[0], color_tint[1], color_tint[2], 1.0)
        nt.links.new(tex_node.outputs["Color"], mix.inputs["A"])
        nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    else:
        nt.links.new(tex_node.outputs["Color"], bsdf.inputs["Base Color"])

    if roughness_img_path:
        r_node = nt.nodes.new("ShaderNodeTexImage")
        r_img = bpy.data.images.load(roughness_img_path, check_existing=True)
        r_img.colorspace_settings.name = 'Non-Color'
        r_img.pack()
        r_node.image = r_img
        nt.links.new(r_node.outputs["Color"], bsdf.inputs["Roughness"])

    return mat


def finalize_bmesh(
    name: str,
    bm: bmesh.types.BMesh,
    mat=None,
    parent=None,
    gltf_loc=(0.0, 0.0, 0.0),
    gltf_quat=None,
    smooth=True,
    subsurf=0,
    bevel_width=0.0,
    bevel_segments=2,
):
    """Convert bmesh to a clean Blender Object with optional bevel/subsurf, UVs, and smooth shading."""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()

    # Ensure UV layer exists so glTF always exports TEXCOORD_0 if needed
    if not mesh.uv_layers:
        uv_layer = mesh.uv_layers.new(name="UVMap")
        verts = mesh.vertices
        for poly in mesh.polygons:
            for li in poly.loop_indices:
                v = verts[mesh.loops[li].vertex_index].co
                uv_layer.data[li].uv = (v.x * 0.5 + 0.5, v.y * 0.5 + 0.5)

    if smooth:
        mesh.polygons.foreach_set("use_smooth", [True] * len(mesh.polygons))
    else:
        mesh.polygons.foreach_set("use_smooth", [False] * len(mesh.polygons))
    mesh.update()

    obj = bpy.data.objects.new(name, mesh)
    if mat is not None:
        obj.data.materials.append(mat)
    obj.location = g2b(*gltf_loc)
    obj.rotation_mode = 'QUATERNION'
    if gltf_quat is not None:
        obj.rotation_quaternion = gltf_quat
    link_obj(obj, parent)

    if bevel_width > 0.0:
        mod = obj.modifiers.new("Bevel", 'BEVEL')
        mod.width = bevel_width
        mod.segments = bevel_segments
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(32)
        mod.harden_normals = False

    if subsurf > 0:
        mod = obj.modifiers.new("Subsurf", 'SUBSURF')
        mod.levels = subsurf
        mod.render_levels = subsurf

    return obj


def apply_all_modifiers():
    """Apply all modifiers on all mesh objects in the scene cleanly."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in list(bpy.data.objects):
        if obj.type == 'MESH' and obj.modifiers:
            obj_eval = obj.evaluated_get(depsgraph)
            new_mesh = bpy.data.meshes.new_from_object(obj_eval)
            old_mesh = obj.data
            obj.modifiers.clear()
            obj.data = new_mesh
            if old_mesh.users == 0:
                bpy.data.meshes.remove(old_mesh)


def merge_mesh_objects_into_one(mesh_objs, merged_name: str, parent=None):
    """Merge a list of sibling MESH objects (same parent space) into ONE multi-material MESH object.
    Preserves exact local transforms, materials, UVs, and smooth/flat shading per polygon while
    dramatically cutting GPU draw calls!
    """
    if not mesh_objs:
        return None
    if len(mesh_objs) == 1:
        return mesh_objs[0]

    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in mesh_objs:
        if obj.modifiers:
            obj_eval = obj.evaluated_get(depsgraph)
            new_mesh = bpy.data.meshes.new_from_object(obj_eval)
            old_mesh = obj.data
            obj.modifiers.clear()
            obj.data = new_mesh
            if old_mesh.users == 0:
                bpy.data.meshes.remove(old_mesh)

    # Combine using bmesh while remapping material indices cleanly
    combined_mats = []
    mat_to_idx = {}
    bm_out = bmesh.new()
    uv_out = bm_out.loops.layers.uv.new("UVMap")

    for obj in mesh_objs:
        mesh = obj.data
        local_mat = obj.matrix_local.copy()
        obj_mat_map = {}
        for slot_idx, m in enumerate(mesh.materials):
            if m is None:
                continue
            if m.name not in mat_to_idx:
                mat_to_idx[m.name] = len(combined_mats)
                combined_mats.append(m)
            obj_mat_map[slot_idx] = mat_to_idx[m.name]

        bm_src = bmesh.new()
        bm_src.from_mesh(mesh)
        bmesh.ops.transform(bm_src, matrix=local_mat, verts=bm_src.verts)
        uv_src = bm_src.loops.layers.uv.active

        vert_map = {}
        for v in bm_src.verts:
            vert_map[v.index] = bm_out.verts.new(v.co)
        bm_src.verts.ensure_lookup_table()
        for f in bm_src.faces:
            try:
                nf = bm_out.faces.new([vert_map[v.index] for v in f.verts])
            except ValueError:
                continue
            nf.smooth = f.smooth
            nf.material_index = obj_mat_map.get(f.material_index, 0)
            if uv_src is not None:
                for lp_src, lp_dst in zip(f.loops, nf.loops):
                    lp_dst[uv_out].uv = lp_src[uv_src].uv
        bm_src.free()

    new_mesh = bpy.data.meshes.new(merged_name)
    bm_out.to_mesh(new_mesh)
    bm_out.free()
    for m in combined_mats:
        new_mesh.materials.append(m)
    new_mesh.update()

    merged_obj = bpy.data.objects.new(merged_name, new_mesh)
    merged_obj.rotation_mode = 'QUATERNION'
    link_obj(merged_obj, parent)

    for obj in mesh_objs:
        old_m = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
        if old_m.users == 0:
            bpy.data.meshes.remove(old_m)

    return merged_obj


def join_direct_mesh_children(parent_obj, merged_name: str):
    """Merge all direct MESH children of parent_obj (keeping child EMPTY sub-hierarchies intact)."""
    direct_meshes = [c for c in list(parent_obj.children) if c.type == 'MESH']
    return merge_mesh_objects_into_one(direct_meshes, merged_name, parent=parent_obj)


def make_box(
    name: str,
    sx: float,
    sy: float,
    sz: float,
    mat=None,
    parent=None,
    gltf_loc=(0.0, 0.0, 0.0),
    gltf_quat=None,
    bevel=0.02,
    bevel_segments=2,
    subsurf=0,
    smooth=True,
):
    """Create a beveled box sized (sx, sy, sz) in glTF axes (X width, Y height, Z depth)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    # glTF (sx, sy, sz) -> Blender scale (sx, sz, sy)
    bmesh.ops.scale(bm, vec=(sx, sz, sy), verts=bm.verts)
    return finalize_bmesh(
        name,
        bm,
        mat=mat,
        parent=parent,
        gltf_loc=gltf_loc,
        gltf_quat=gltf_quat,
        smooth=smooth,
        subsurf=subsurf,
        bevel_width=bevel,
        bevel_segments=bevel_segments,
    )


def make_sphere(
    name: str,
    radius: float,
    scale=(1.0, 1.0, 1.0),
    mat=None,
    parent=None,
    gltf_loc=(0.0, 0.0, 0.0),
    gltf_quat=None,
    segments=20,
    rings=14,
    smooth=True,
):
    """Create a smooth ellipsoid scaled by (sx, sy, sz) in glTF axes."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius)
    bmesh.ops.scale(bm, vec=(scale[0], scale[2], scale[1]), verts=bm.verts)
    return finalize_bmesh(
        name,
        bm,
        mat=mat,
        parent=parent,
        gltf_loc=gltf_loc,
        gltf_quat=gltf_quat,
        smooth=smooth,
    )


def make_lathe(
    name: str,
    profile_xy,
    segments=20,
    mat=None,
    parent=None,
    gltf_loc=(0.0, 0.0, 0.0),
    gltf_quat=None,
    cap_bottom=True,
    cap_top=True,
    smooth=True,
    subsurf=0,
    scale_xz=(1.0, 1.0),
):
    """Revolve a profile [(radius, gltf_y), ...] around glTF +Y (Blender +Z)."""
    bm = bmesh.new()
    rings = []
    for r, y in profile_xy:
        rr = max(1e-4, float(r))
        ring = []
        for s in range(segments):
            ang = (s / segments) * math.tau
            gx = math.cos(ang) * rr * scale_xz[0]
            gz = math.sin(ang) * rr * scale_xz[1]
            ring.append(bm.verts.new(g2b(gx, y, gz)))
        rings.append(ring)

    for i in range(len(rings) - 1):
        r0, r1 = rings[i], rings[i + 1]
        for s in range(segments):
            sn = (s + 1) % segments
            bm.faces.new((r0[s], r0[sn], r1[sn], r1[s]))

    if cap_bottom and profile_xy[0][0] > 1e-3:
        bm.faces.new(list(reversed(rings[0])))
    if cap_top and profile_xy[-1][0] > 1e-3:
        bm.faces.new(rings[-1])

    return finalize_bmesh(
        name,
        bm,
        mat=mat,
        parent=parent,
        gltf_loc=gltf_loc,
        gltf_quat=gltf_quat,
        smooth=smooth,
        subsurf=subsurf,
    )


def make_tube(
    name: str,
    gltf_points,
    radii,
    segments=12,
    closed=False,
    cap_ends=True,
    mat=None,
    parent=None,
    gltf_loc=(0.0, 0.0, 0.0),
    gltf_quat=None,
    smooth=True,
    subsurf=0,
):
    """Sweep a circular cross-section along 3D glTF points with scalar or per-point radii."""
    pts = [g2b(*p) for p in gltf_points]
    n = len(pts)
    if isinstance(radii, (int, float)):
        rad_list = [float(radii)] * n
    else:
        rad_list = [float(r) for r in radii]

    bm = bmesh.new()
    rings = []
    prev_up = None

    for i in range(n):
        p = pts[i]
        if closed:
            tangent = (pts[(i + 1) % n] - pts[(i - 1) % n]).normalized()
        elif i == 0:
            tangent = (pts[1] - pts[0]).normalized()
        elif i == n - 1:
            tangent = (pts[-1] - pts[-2]).normalized()
        else:
            tangent = (pts[i + 1] - pts[i - 1]).normalized()

        if tangent.length < 1e-6:
            tangent = Vector((0, 0, 1))

        if prev_up is None:
            ref = Vector((0, 0, 1)) if abs(tangent.z) < 0.92 else Vector((1, 0, 0))
            side = tangent.cross(ref).normalized()
            up = side.cross(tangent).normalized()
        else:
            # Parallel transport to prevent twist
            side = tangent.cross(prev_up)
            if side.length < 1e-6:
                ref = Vector((1, 0, 0)) if abs(tangent.x) < 0.9 else Vector((0, 1, 0))
                side = tangent.cross(ref)
            side.normalize()
            up = side.cross(tangent).normalized()
        prev_up = up

        r = max(1e-4, rad_list[i])
        ring = []
        for s in range(segments):
            ang = (s / segments) * math.tau
            offset = (side * math.cos(ang) + up * math.sin(ang)) * r
            ring.append(bm.verts.new(p + offset))
        rings.append(ring)

    ring_pairs = n if closed else n - 1
    for i in range(ring_pairs):
        r0 = rings[i]
        r1 = rings[(i + 1) % n]
        for s in range(segments):
            sn = (s + 1) % segments
            bm.faces.new((r0[s], r0[sn], r1[sn], r1[s]))

    if not closed and cap_ends:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])

    return finalize_bmesh(
        name,
        bm,
        mat=mat,
        parent=parent,
        gltf_loc=gltf_loc,
        gltf_quat=gltf_quat,
        smooth=smooth,
        subsurf=subsurf,
    )


def make_loft(
    name: str,
    sections_gltf,
    mat=None,
    parent=None,
    gltf_loc=(0.0, 0.0, 0.0),
    gltf_quat=None,
    cap_start=True,
    cap_end=True,
    smooth=True,
    subsurf=1,
):
    """Loft a smooth 3D body through a list of cross-section rings, each a list of glTF (x,y,z) points."""
    bm = bmesh.new()
    rings = []
    for sec in sections_gltf:
        rings.append([bm.verts.new(g2b(*pt)) for pt in sec])

    ring_len = len(rings[0])
    for i in range(len(rings) - 1):
        r0, r1 = rings[i], rings[i + 1]
        for s in range(ring_len):
            sn = (s + 1) % ring_len
            bm.faces.new((r0[s], r0[sn], r1[sn], r1[s]))

    if cap_start:
        bm.faces.new(list(reversed(rings[0])))
    if cap_end:
        bm.faces.new(rings[-1])

    return finalize_bmesh(
        name,
        bm,
        mat=mat,
        parent=parent,
        gltf_loc=gltf_loc,
        gltf_quat=gltf_quat,
        smooth=smooth,
        subsurf=subsurf,
    )


def make_extruded_poly(
    name: str,
    poly_2d_xy,
    depth_z: float,
    mat=None,
    parent=None,
    gltf_loc=(0.0, 0.0, 0.0),
    gltf_quat=None,
    bevel=0.02,
    smooth=True,
):
    """Extrude a 2D polygon in glTF XY across [-depth_z/2, +depth_z/2]."""
    bm = bmesh.new()
    hz = depth_z * 0.5
    front = [bm.verts.new(g2b(x, y, hz)) for x, y in poly_2d_xy]
    back = [bm.verts.new(g2b(x, y, -hz)) for x, y in poly_2d_xy]
    n = len(poly_2d_xy)
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((back[i], back[j], front[j], front[i]))

    return finalize_bmesh(
        name,
        bm,
        mat=mat,
        parent=parent,
        gltf_loc=gltf_loc,
        gltf_quat=gltf_quat,
        smooth=smooth,
        bevel_width=bevel,
        bevel_segments=2,
    )


def make_crystal_spire(
    name: str,
    radius: float,
    height: float,
    sides=6,
    mat=None,
    parent=None,
    gltf_loc=(0.0, 0.0, 0.0),
    gltf_quat=None,
    double_ended=False,
    bevel=0.015,
):
    """Create a crisp faceted crystal spire along glTF +Y."""
    bm = bmesh.new()
    if double_ended:
        y_bot, y_low, y_high, y_top = -height * 0.5, -height * 0.18, height * 0.18, height * 0.5
        r_low, r_high = radius * 0.96, radius * 0.88
    else:
        y_bot, y_low, y_high, y_top = 0.0, height * 0.12, height * 0.72, height
        r_low, r_high = radius * 1.0, radius * 0.76

    v_bot = bm.verts.new(g2b(0, y_bot, 0))
    v_top = bm.verts.new(g2b(0, y_top, 0))
    ring_low = []
    ring_high = []
    for s in range(sides):
        a = (s / sides) * math.tau
        ring_low.append(bm.verts.new(g2b(math.cos(a) * r_low, y_low, math.sin(a) * r_low)))
        ring_high.append(bm.verts.new(g2b(math.cos(a + 0.08) * r_high, y_high, math.sin(a + 0.08) * r_high)))

    for s in range(sides):
        sn = (s + 1) % sides
        if double_ended:
            bm.faces.new((v_bot, ring_low[sn], ring_low[s]))
        else:
            bm.faces.new((v_bot, ring_low[sn], ring_low[s]))
        bm.faces.new((ring_low[s], ring_low[sn], ring_high[sn], ring_high[s]))
        bm.faces.new((ring_high[s], ring_high[sn], v_top))

    return finalize_bmesh(
        name,
        bm,
        mat=mat,
        parent=parent,
        gltf_loc=gltf_loc,
        gltf_quat=gltf_quat,
        smooth=False,
        bevel_width=bevel,
        bevel_segments=1,
    )


def export_glb(out_path: str, animated=False, image_format='AUTO'):
    """Export current scene to clean glTF 2.0 binary (.glb) compatible with Three.js & NodeIO."""
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    apply_all_modifiers()
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        export_yup=True,
        export_apply=False,
        export_normals=True,
        export_texcoords=True,
        export_materials='EXPORT',
        export_image_format=image_format,
        export_animations=animated,
        export_animation_mode='NLA_TRACKS' if animated else 'ACTIONS',
        export_nla_strips=animated,
        export_nla_strips_merged_animation_name='',
        export_optimize_animation_size=True,
        export_cameras=False,
        export_lights=False,
    )
    return os.path.getsize(out_path)


def setup_cycles_studio(res_x: int, res_y: int, samples=28):
    """Configure fast, crisp Cycles CPU studio lighting with transparent background."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 4
    scene.cycles.diffuse_bounces = 2
    scene.cycles.glossy_bounces = 2
    scene.cycles.transparent_max_bounces = 4
    scene.render.resolution_x = res_x
    scene.render.resolution_y = res_y
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'Filmic'
    scene.view_settings.look = 'Medium High Contrast'
    scene.view_settings.exposure = -0.25

    # Soft studio world ambient
    world = bpy.data.worlds.new("StudioWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.28, 0.34, 0.46, 1.0)
        bg.inputs["Strength"].default_value = 0.42

    def add_area_light(name, gltf_pos, look_at_gltf, energy, size, color):
        ldata = bpy.data.lights.new(name=name, type='AREA')
        ldata.energy = energy
        ldata.size = size
        ldata.color = color
        lobj = bpy.data.objects.new(name=name, object_data=ldata)
        lobj.location = g2b(*gltf_pos)
        direction = g2b(*look_at_gltf) - lobj.location
        lobj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
        bpy.context.scene.collection.objects.link(lobj)
        return lobj

    return add_area_light


def render_studio_badge_png(
    out_path: str,
    cam_gltf_pos,
    look_at_gltf,
    lens_mm: float,
    size: int,
    bg_top_rgb,
    bg_bot_rgb,
    rim_rgb,
    rim_width=0.055,
    samples=28,
    rim_light_color=(0.45, 0.82, 1.0),
):
    """Render current 3D scene with Cycles onto a transparent buffer and composite a crisp circular badge PNG."""
    add_area = setup_cycles_studio(size, size, samples=samples)
    cx, cy, cz = look_at_gltf

    # Key, Fill, and Rim studio lights (balanced for rich saturation & depth under Filmic)
    lights = [
        add_area("KeyLight", (cx + 1.9, cy + 1.9, cz - 2.3), look_at_gltf, 95.0, 2.2, (1.0, 0.95, 0.88)),
        add_area("FillLight", (cx - 2.1, cy + 0.7, cz - 1.5), look_at_gltf, 34.0, 2.8, (0.76, 0.86, 1.0)),
        add_area("RimLight", (cx - 0.5, cy + 1.6, cz + 2.2), look_at_gltf, 95.0, 1.8, rim_light_color),
    ]

    cam_data = bpy.data.cameras.new("BadgeCam")
    cam_data.lens = lens_mm
    cam_data.clip_start = 0.05
    cam_obj = bpy.data.objects.new("BadgeCam", cam_data)
    cam_obj.location = g2b(*cam_gltf_pos)
    direction = g2b(*look_at_gltf) - cam_obj.location
    cam_obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj

    tmp_render = out_path + ".raw.png"
    bpy.context.scene.render.filepath = tmp_render
    bpy.ops.render.render(write_still=True)

    # Clean up temporary camera & lights
    for obj in [cam_obj, *lights]:
        bpy.data.objects.remove(obj, do_unlink=True)

    # Composite rendered subject over stylized glossy medallion badge using numpy
    img = bpy.data.images.load(tmp_render)
    w, h = img.size
    fg = np.array(img.pixels[:], dtype=np.float32).reshape((h, w, 4))
    bpy.data.images.remove(img)
    if os.path.exists(tmp_render):
        os.remove(tmp_render)

    # Note: Blender image pixels are bottom-up (row 0 = bottom)
    ys = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None]
    xs = np.linspace(0.0, 1.0, w, dtype=np.float32)[None, :]
    dx = xs - 0.5
    dy = ys - 0.5
    dist = np.sqrt(dx * dx + dy * dy)
    angle = np.arctan2(dy, dx)

    outer_r = 0.485
    inner_r = outer_r - rim_width
    aa = 1.5 / size

    # Anti-aliased outer circle mask
    outer_mask = np.clip((outer_r - dist) / aa + 0.5, 0.0, 1.0)
    inner_mask = np.clip((inner_r - dist) / aa + 0.5, 0.0, 1.0)
    rim_mask = np.clip(outer_mask - inner_mask, 0.0, 1.0)

    # Stylized radial sunburst + vertical gradient background (top is y=1 in Blender)
    t_vert = 1.0 - ys  # 0 at top, 1 at bottom
    sunburst = 0.90 + 0.10 * np.sin(angle * 10.0) * np.clip(dist * 2.2, 0.0, 1.0)
    radial_glow = np.exp(-((dist / 0.34) ** 2)) * 0.24

    bg_r = np.clip((bg_top_rgb[0] * (1.0 - t_vert) + bg_bot_rgb[0] * t_vert) * sunburst + radial_glow, 0.0, 1.0)
    bg_g = np.clip((bg_top_rgb[1] * (1.0 - t_vert) + bg_bot_rgb[1] * t_vert) * sunburst + radial_glow, 0.0, 1.0)
    bg_b = np.clip((bg_top_rgb[2] * (1.0 - t_vert) + bg_bot_rgb[2] * t_vert) * sunburst + radial_glow, 0.0, 1.0)

    # Subtle glossy top arc highlight inside badge
    gloss = np.clip(1.0 - ((dx * 1.1) ** 2 + ((ys - 0.78) * 2.4) ** 2), 0.0, 1.0) * 0.14
    bg_r = np.clip(bg_r + gloss, 0.0, 1.0)
    bg_g = np.clip(bg_g + gloss, 0.0, 1.0)
    bg_b = np.clip(bg_b + gloss, 0.0, 1.0)

    # Soft dark vignette near inner rim
    vig = np.clip((dist - (inner_r - 0.09)) / 0.09, 0.0, 1.0) * 0.28
    bg_r *= (1.0 - vig)
    bg_g *= (1.0 - vig)
    bg_b *= (1.0 - vig)

    # Alpha-composite rendered 3D subject inside the medallion
    fg_a = fg[:, :, 3] * inner_mask
    comp_r = fg[:, :, 0] * fg_a + bg_r * (1.0 - fg_a)
    comp_g = fg[:, :, 1] * fg_a + bg_g * (1.0 - fg_a)
    comp_b = fg[:, :, 2] * fg_a + bg_b * (1.0 - fg_a)

    # Metallic beveled rim ring with specular highlight at top-left
    rim_shine = 0.72 + 0.40 * np.clip(np.cos(angle - 2.2), -0.4, 1.0)
    rim_r = np.clip(rim_rgb[0] * rim_shine, 0.0, 1.0)
    rim_g = np.clip(rim_rgb[1] * rim_shine, 0.0, 1.0)
    rim_b = np.clip(rim_rgb[2] * rim_shine, 0.0, 1.0)

    # Crisp thin dark hairline inside rim for definition
    hairline = np.clip(1.0 - np.abs(dist - inner_r) / (1.8 / size), 0.0, 1.0) * 0.55

    final_r = np.clip(comp_r * (1.0 - rim_mask) * (1.0 - hairline) + rim_r * rim_mask, 0.0, 1.0)
    final_g = np.clip(comp_g * (1.0 - rim_mask) * (1.0 - hairline) + rim_g * rim_mask, 0.0, 1.0)
    final_b = np.clip(comp_b * (1.0 - rim_mask) * (1.0 - hairline) + rim_b * rim_mask, 0.0, 1.0)

    out_rgba = np.stack([final_r, final_g, final_b, outer_mask], axis=-1).astype(np.float32)

    out_img = bpy.data.images.new("BadgeOut", width=w, height=h, alpha=True)
    out_img.pixels[:] = out_rgba.ravel().tolist()
    out_img.filepath_raw = out_path
    out_img.file_format = 'PNG'
    out_img.save()
    bpy.data.images.remove(out_img)
    return os.path.getsize(out_path)
