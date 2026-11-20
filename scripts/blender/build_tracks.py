"""Blender 4.5 generator for all 8 high-craft Track GLBs with sculpted instanced biome scenery."""

import json
import math
import os
import sys
import bpy
import bmesh
from mathutils import Matrix, Quaternion, Vector

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
CACHE_DIR = os.path.join(SCRIPT_DIR, ".cache")
sys.path.insert(0, SCRIPT_DIR)

from blender_utils import (
    export_glb,
    finalize_bmesh,
    g2b,
    gltf_axis_angle_to_blender_quat as qax,
    join_direct_mesh_children,
    make_box,
    make_crystal_spire,
    make_empty,
    make_extruded_poly,
    make_image_mat,
    make_lathe,
    make_pbr_mat,
    make_sphere,
    make_tube,
    merge_mesh_objects_into_one,
    reset_scene,
)

BIOME_PALETTES = {
    "porto": {
        "wall": (0.86, 0.80, 0.72),
        "coping": (0.94, 0.89, 0.82),
        "ramp": (0.94, 0.60, 0.14),
        "tunnel": (0.34, 0.31, 0.36),
        "tunnel_light": (1.0, 0.68, 0.22),
        "foliage": (0.16, 0.56, 0.24),
        "foliage_alt": (0.24, 0.64, 0.28),
        "base_surface": "grass",
        "water": (0.18, 0.66, 0.88),
        "has_water": True,
        "rock": (0.48, 0.44, 0.40),
    },
    "bosque": {
        "wall": (0.30, 0.44, 0.36),
        "coping": (0.42, 0.62, 0.50),
        "ramp": (0.12, 0.74, 0.54),
        "tunnel": (0.15, 0.24, 0.36),
        "tunnel_light": (0.24, 0.94, 0.98),
        "foliage": (0.09, 0.50, 0.32),
        "foliage_alt": (0.16, 0.64, 0.42),
        "base_surface": "grass",
        "water": (0.16, 0.82, 0.78),
        "has_water": True,
        "rock": (0.38, 0.42, 0.40),
    },
    "vale": {
        "wall": (0.68, 0.62, 0.52),
        "coping": (0.84, 0.78, 0.66),
        "ramp": (0.88, 0.52, 0.14),
        "tunnel": (0.42, 0.38, 0.34),
        "tunnel_light": (1.0, 0.86, 0.42),
        "foliage": (0.16, 0.56, 0.24),
        "foliage_alt": (0.26, 0.66, 0.26),
        "base_surface": "grass",
        "water": (0.22, 0.70, 0.92),
        "has_water": True,
        "rock": (0.50, 0.46, 0.42),
    },
    "canion": {
        "wall": (0.76, 0.36, 0.20),
        "coping": (0.88, 0.52, 0.28),
        "ramp": (0.96, 0.56, 0.14),
        "tunnel": (0.56, 0.25, 0.15),
        "tunnel_light": (1.0, 0.60, 0.14),
        "foliage": (0.22, 0.54, 0.24),
        "foliage_alt": (0.28, 0.60, 0.28),
        "base_surface": "sand",
        "water": (0.86, 0.62, 0.32),
        "has_water": False,
        "rock": (0.74, 0.34, 0.18),
    },
    "neon": {
        "wall": (0.12, 0.15, 0.30),
        "coping": (0.22, 0.84, 1.0),
        "ramp": (0.20, 0.84, 0.98),
        "tunnel": (0.07, 0.09, 0.22),
        "tunnel_light": (0.20, 0.88, 1.0),
        "foliage": (0.14, 0.46, 0.80),
        "foliage_alt": (0.22, 0.68, 0.96),
        "base_surface": "asphalt",
        "water": (0.10, 0.14, 0.32),
        "has_water": False,
        "rock": (0.20, 0.22, 0.34),
    },
    "boreal": {
        "wall": (0.64, 0.84, 0.96),
        "coping": (0.90, 0.96, 1.0),
        "ramp": (0.32, 0.90, 0.96),
        "tunnel": (0.34, 0.60, 0.84),
        "tunnel_light": (0.34, 0.98, 0.88),
        "foliage": (0.16, 0.48, 0.52),
        "foliage_alt": (0.22, 0.56, 0.60),
        "base_surface": "snow",
        "water": (0.24, 0.72, 0.90),
        "has_water": True,
        "rock": (0.52, 0.66, 0.78),
    },
    "celeste": {
        "wall": (0.94, 0.91, 0.98),
        "coping": (0.98, 0.80, 0.24),
        "ramp": (0.98, 0.76, 0.20),
        "tunnel": (0.78, 0.72, 0.92),
        "tunnel_light": (0.98, 0.86, 0.48),
        "foliage": (0.18, 0.68, 0.48),
        "foliage_alt": (0.32, 0.78, 0.54),
        "base_surface": "cloud",
        "water": (0.85, 0.92, 1.0),
        "has_water": False,
        "rock": (0.84, 0.82, 0.90),
    },
    "fortaleza": {
        "wall": (0.26, 0.24, 0.33),
        "coping": (0.44, 0.40, 0.54),
        "ramp": (0.66, 0.40, 0.96),
        "tunnel": (0.16, 0.14, 0.24),
        "tunnel_light": (0.68, 0.52, 1.0),
        "foliage": (0.20, 0.28, 0.34),
        "foliage_alt": (0.28, 0.34, 0.40),
        "base_surface": "asphalt",
        "water": (0.16, 0.20, 0.36),
        "has_water": True,
        "rock": (0.28, 0.26, 0.34),
    },
}


def make_uv_mesh_from_quads(name, verts_gltf, uvs_list, quads, mat, parent, smooth=True):
    """Build a crisp mesh with explicit world/metric UVs directly in Blender."""
    mesh = bpy.data.meshes.new(name)
    verts_b = [g2b(*v) for v in verts_gltf]
    mesh.from_pydata(verts_b, [], quads)
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for poly in mesh.polygons:
        for li in poly.loop_indices:
            vi = mesh.loops[li].vertex_index
            uv_layer.data[li].uv = uvs_list[vi]
    mesh.polygons.foreach_set("use_smooth", [smooth] * len(mesh.polygons))
    mesh.update()

    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(mat)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    return obj


def make_uv_box(name, w, h, d, uv_x, uv_z, mat, parent, gltf_loc=(0, 0, 0), yaw=0.0):
    hw, hh, hd = w * 0.5, h * 0.5, d * 0.5
    verts = [
        # +Y top
        (-hw, hh, hd), (hw, hh, hd), (hw, hh, -hd), (-hw, hh, -hd),
        # -Y bottom
        (-hw, -hh, -hd), (hw, -hh, -hd), (hw, -hh, hd), (-hw, -hh, hd),
        # +Z front
        (-hw, -hh, hd), (hw, -hh, hd), (hw, hh, hd), (-hw, hh, hd),
        # -Z back
        (hw, -hh, -hd), (-hw, -hh, -hd), (-hw, hh, -hd), (hw, hh, -hd),
        # +X right
        (hw, -hh, hd), (hw, -hh, -hd), (hw, hh, -hd), (hw, hh, hd),
        # -X left
        (-hw, -hh, -hd), (-hw, -hh, hd), (-hw, hh, hd), (-hw, hh, -hd),
    ]
    uvs = [
        (0, 0), (uv_x, 0), (uv_x, uv_z), (0, uv_z),
        (0, 0), (uv_x, 0), (uv_x, uv_z), (0, uv_z),
        (0, 0), (uv_x, 0), (uv_x, 1), (0, 1),
        (0, 0), (uv_x, 0), (uv_x, 1), (0, 1),
        (0, 0), (uv_z, 0), (uv_z, 1), (0, 1),
        (0, 0), (uv_z, 0), (uv_z, 1), (0, 1),
    ]
    quads = [(i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 3) for i in range(6)]
    obj = make_uv_mesh_from_quads(name, verts, uvs, quads, mat, parent, smooth=False)
    obj.location = g2b(*gltf_loc)
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = qax(0, 1, 0, yaw)
    return obj


def build_road_and_curbs(samples, half_width, curb_width, closed, road_mat, curb_mat, parent, road_name="MainRoadMesh", make_curbs=True):
    """Build smooth spline road ribbon + beveled 3D racing apex curbs."""
    n = len(samples)
    ring_count = n + 1 if closed else n

    r_verts, r_uvs, r_quads = [], [], []
    lc_verts, lc_uvs, lc_quads = [], [], []
    rc_verts, rc_uvs, rc_quads = [], [], []

    accum_s = 0.0
    for i in range(ring_count):
        s = samples[i % n]
        if i > 0:
            prev = samples[(i - 1) % n]
            accum_s += math.hypot(s["point"]["x"] - prev["point"]["x"], s["point"]["z"] - prev["point"]["z"])
        px, py, pz = s["point"]["x"], s["point"]["y"], s["point"]["z"]
        rx, rz = s["right"]["x"], s["right"]["z"]

        v_road = accum_s / 14.0
        v_curb = accum_s / 5.5

        # Road left & right edges
        r_verts.append((px - rx * half_width, py, pz - rz * half_width))
        r_verts.append((px + rx * half_width, py, pz + rz * half_width))
        r_uvs.extend([(0.0, v_road), (1.0, v_road)])

        if make_curbs:
            # Raised angled 3D curb (inner edge at road height, peak raised 0.10m, outer edge grounded)
            lo0 = -(half_width + curb_width)
            lo1 = -(half_width + curb_width * 0.25)
            lo2 = -half_width
            lc_verts.extend([
                (px + rx * lo0, py - 0.03, pz + rz * lo0),
                (px + rx * lo1, py + 0.09, pz + rz * lo1),
                (px + rx * lo2, py + 0.01, pz + rz * lo2),
            ])
            lc_uvs.extend([(0.0, v_curb), (0.65, v_curb), (1.0, v_curb)])

            ro0 = half_width
            ro1 = half_width + curb_width * 0.25
            ro2 = half_width + curb_width
            rc_verts.extend([
                (px + rx * ro0, py + 0.01, pz + rz * ro0),
                (px + rx * ro1, py + 0.09, pz + rz * ro1),
                (px + rx * ro2, py - 0.03, pz + rz * ro2),
            ])
            rc_uvs.extend([(0.0, v_curb), (0.35, v_curb), (1.0, v_curb)])

    for i in range(ring_count - 1):
        a = i * 2
        b = (i + 1) * 2
        r_quads.append((a, a + 1, b + 1, b))
        if make_curbs:
            ca = i * 3
            cb = (i + 1) * 3
            lc_quads.append((ca, ca + 1, cb + 1, cb))
            lc_quads.append((ca + 1, ca + 2, cb + 2, cb + 1))
            rc_quads.append((ca, ca + 1, cb + 1, cb))
            rc_quads.append((ca + 1, ca + 2, cb + 2, cb + 1))

    make_uv_mesh_from_quads(road_name, r_verts, r_uvs, r_quads, road_mat, parent, smooth=True)
    if make_curbs:
        make_uv_mesh_from_quads("LeftCurbMesh", lc_verts, lc_uvs, lc_quads, curb_mat, parent, smooth=False)
        make_uv_mesh_from_quads("RightCurbMesh", rc_verts, rc_uvs, rc_quads, curb_mat, parent, smooth=False)


def build_wall_with_coping(samples, offset_from_center, wall_h, wall_t, wall_mat, coping_mat, parent, name):
    """Build retaining wall with proper world-metric UVs AND a sculpted beveled coping cap on top."""
    n = len(samples)
    ring_count = n + 1
    sgn = 1.0 if offset_from_center > 0 else -1.0
    in_off = offset_from_center - sgn * wall_t * 0.5
    out_off = offset_from_center + sgn * wall_t * 0.5

    w_verts, w_uvs, w_quads = [], [], []
    c_verts, c_uvs, c_quads = [], [], []
    accum_s = 0.0

    for i in range(ring_count):
        s = samples[i % n]
        if i > 0:
            prev = samples[(i - 1) % n]
            accum_s += math.hypot(s["point"]["x"] - prev["point"]["x"], s["point"]["z"] - prev["point"]["z"])
        px, py, pz = s["point"]["x"], s["point"]["y"], s["point"]["z"]
        rx, rz = s["right"]["x"], s["right"]["z"]

        # Proper metric tiling: 1 tile every 4.2m along track, proportional height!
        u_tile = accum_s / 4.2
        w_verts.extend([
            (px + rx * in_off, py - 0.15, pz + rz * in_off),
            (px + rx * in_off, py + wall_h, pz + rz * in_off),
            (px + rx * out_off, py + wall_h, pz + rz * out_off),
            (px + rx * out_off, py - 0.15, pz + rz * out_off),
        ])
        w_uvs.extend([(u_tile, 0.0), (u_tile, 0.55), (u_tile, 0.80), (u_tile, 0.0)])

        # Overhanging coping stone slab on top of wall
        c_in = in_off - sgn * 0.10
        c_out = out_off + sgn * 0.10
        c_verts.extend([
            (px + rx * c_in, py + wall_h - 0.02, pz + rz * c_in),
            (px + rx * c_in, py + wall_h + 0.18, pz + rz * c_in),
            (px + rx * c_out, py + wall_h + 0.18, pz + rz * c_out),
            (px + rx * c_out, py + wall_h - 0.02, pz + rz * c_out),
        ])
        c_uvs.extend([(u_tile, 0.0), (u_tile, 0.35), (u_tile, 0.70), (u_tile, 1.0)])

    for i in range(ring_count - 1):
        a, b = i * 4, (i + 1) * 4
        for f in range(3):
            if offset_from_center > 0:
                w_quads.append((a + f, b + f, b + f + 1, a + f + 1))
                c_quads.append((a + f, b + f, b + f + 1, a + f + 1))
            else:
                w_quads.append((a + f, a + f + 1, b + f + 1, b + f))
                c_quads.append((a + f, a + f + 1, b + f + 1, b + f))

    make_uv_mesh_from_quads(name, w_verts, w_uvs, w_quads, wall_mat, parent, smooth=False)
    make_uv_mesh_from_quads(f"{name}_Coping", c_verts, c_uvs, c_quads, coping_mat, parent, smooth=False)


def build_tunnel(samples, s_start, s_end, arch_r, tunnel_mat, light_mat, parent):
    seg = [s for s in samples if s_start <= s["s"] <= s_end]
    if len(seg) < 2:
        return
    arc_segs = 10
    verts, uvs, quads = [], [], []
    light_pts = []
    for i, s in enumerate(seg):
        v = i / max(1, len(seg) - 1) * 6.0
        px, py, pz = s["point"]["x"], s["point"]["y"], s["point"]["z"]
        rx, rz = s["right"]["x"], s["right"]["z"]
        light_pts.append((px, py + arch_r - 0.35, pz))
        for a in range(arc_segs + 1):
            th = (a / arc_segs) * math.pi
            lat = -math.cos(th) * arch_r
            h = math.sin(th) * arch_r
            verts.append((px + rx * lat, py + h, pz + rz * lat))
            uvs.append((a / arc_segs * 2.0, v))
    stride = arc_segs + 1
    for i in range(len(seg) - 1):
        for a in range(arc_segs):
            p0 = i * stride + a
            p1 = p0 + 1
            p2 = (i + 1) * stride + a
            p3 = p2 + 1
            quads.append((p0, p2, p3, p1))
    make_uv_mesh_from_quads("CoastalTunnelShell", verts, uvs, quads, tunnel_mat, parent, smooth=True)
    make_tube("CoastalTunnelLightStrip", light_pts, 0.24, segments=8, mat=light_mat, parent=parent)


def build_proto_registry():
    """Prototype builder that captures reusable Mesh datablocks + local transforms for true glTF instancing."""
    return {}


def build_scenery_prototypes(biome, pal, mats, half_width):
    """Build rich sculpted Blender mesh prototypes (parts list of (mesh, loc_b, quat_b, scale_b)).
    All temporary builder objects are unlinked after extracting their Mesh datablocks so only instanced
    nodes appear in the exported GLB!
    """
    def capture(builder_fn, proto_name="ProtoMesh"):
        before = set(bpy.data.objects)
        builder_fn()
        created = [o for o in bpy.data.objects if o not in before]
        mesh_objs = [o for o in created if o.type == 'MESH']
        non_mesh = [o for o in created if o.type != 'MESH']
        merged = merge_mesh_objects_into_one(mesh_objs, proto_name, parent=None)
        parts = []
        if merged is not None:
            parts.append((merged.data, merged.location.copy(), merged.rotation_quaternion.copy(), merged.scale.copy()))
            bpy.data.objects.remove(merged, do_unlink=True)
        for obj in non_mesh:
            bpy.data.objects.remove(obj, do_unlink=True)
        return parts

    protos = {}

    # 1. Ornate Wrought-Iron Curved Lantern Post with Hexagonal Glass Lantern
    def _lantern():
        make_lathe("LP_Base", [(0.34, 0.0), (0.26, 0.35), (0.16, 0.65)], segments=10, mat=mats["iron"])
        make_tube("LP_Pole", [(0, 0.55, 0), (0, 3.5, 0), (0, 4.18, -0.35), (0, 4.05, -0.78)], [0.11, 0.085, 0.075, 0.06], segments=8, mat=mats["iron"])
        make_lathe("LP_Cap", [(0.36, 3.85), (0.04, 4.18)], segments=6, mat=mats["iron"], gltf_loc=(0, 0, -0.78), smooth=False)
        make_lathe("LP_Glass", [(0.16, 3.25), (0.28, 3.45), (0.30, 3.82), (0.16, 3.88)], segments=6, mat=mats["lantern"], gltf_loc=(0, 0, -0.78), smooth=False)
    protos["lantern-post"] = capture(_lantern)

    # 2. Chevron Board with Beacons & Frame
    def _chevron():
        for px in (-1.15, 1.15):
            make_tube(f"CH_Post_{px}", [(px, 0, 0), (px, 2.45, 0)], 0.08, segments=8, mat=mats["iron"])
            make_sphere(f"CH_Lamp_{px}", 0.12, mat=mats["lantern"], gltf_loc=(px, 2.58, 0), segments=10, rings=6)
        make_box("CH_Frame", 3.55, 1.38, 0.14, mat=mats["iron"], gltf_loc=(0, 1.85, -0.02), bevel=0.03)
        make_box("CH_Face", 3.40, 1.24, 0.16, mat=mats["chevron"], gltf_loc=(0, 1.85, 0.01), bevel=0.02)
    protos["chevron-board"] = capture(_chevron)

    # 3. Mediterranean Coastal Houses (3 color variants with pitched roof, eaves, chimney, balcony, doorway, shutters)
    for v_idx, stucco in enumerate(mats["stucco"]):
        def _house(s_mat=stucco):
            make_box("H_Plinth", 8.0, 0.65, 6.6, mat=mats["stone"], gltf_loc=(0, 0.32, 0), bevel=0.06)
            make_box("H_Body", 7.6, 5.2, 6.2, mat=s_mat, gltf_loc=(0, 3.15, 0), bevel=0.08)
            roof_poly = [(-4.4, 0.0), (4.4, 0.0), (0.0, 2.55)]
            make_extruded_poly("H_Roof", roof_poly, 7.1, mat=mats["terracotta"], gltf_loc=(0, 5.65, 0), bevel=0.08, smooth=False)
            make_box("H_Chimney", 0.95, 1.9, 0.95, mat=mats["stone"], gltf_loc=(2.3, 6.8, -1.2), bevel=0.05)
            # Arched wooden front door + lintel
            make_box("H_Door", 1.55, 2.45, 0.22, mat=mats["wood"], gltf_loc=(0, 1.75, 3.12), bevel=0.04)
            make_box("H_Balcony", 3.2, 0.22, 1.0, mat=mats["wood"], gltf_loc=(0, 3.15, 3.52), bevel=0.03)
            make_box("H_Rail", 3.2, 0.65, 0.12, mat=mats["iron"], gltf_loc=(0, 3.55, 3.96), bevel=0.02)
            # Glowing shuttered windows on front & sides
            for wx in (-2.05, 2.05):
                make_box(f"H_Win_{wx}", 1.15, 1.25, 0.18, mat=mats["lantern"], gltf_loc=(wx, 3.85, 3.10), bevel=0.03)
                make_box(f"H_WinFrame_{wx}", 1.32, 0.16, 0.24, mat=mats["wood"], gltf_loc=(wx, 3.18, 3.14), bevel=0.02)
                for sh in (-0.75, 0.75):
                    make_box(f"H_Shut_{wx}_{sh}", 0.34, 1.25, 0.10, mat=mats["wood"], gltf_loc=(wx + sh, 3.85, 3.14), bevel=0.015)
        protos[f"house_{v_idx}"] = capture(_house)

    # 4. Coastal Market Stall with Striped Awning, Counter & Wooden Crates
    def _market():
        make_box("M_Counter", 3.8, 1.15, 1.9, mat=mats["wood"], gltf_loc=(0, 0.58, 0), bevel=0.05)
        for sx in (-1.75, 1.75):
            for sz in (-0.82, 0.82):
                make_tube(f"M_Post_{sx}_{sz}", [(sx, 0, sz), (sx, 2.95, sz)], 0.085, segments=8, mat=mats["wood"])
        make_box("M_Awning", 4.35, 0.22, 2.65, mat=mats["red"], gltf_loc=(0, 2.95, 0.05), gltf_quat=qax(1, 0, 0, 0.22), bevel=0.04)
        for ax in (-1.35, 0.0, 1.35):
            make_box(f"M_Stripe_{ax}", 0.58, 0.24, 2.68, mat=mats["stucco"][0], gltf_loc=(ax, 2.96, 0.05), gltf_quat=qax(1, 0, 0, 0.22), bevel=0.02)
        make_box("M_CrateA", 0.65, 0.55, 0.65, mat=mats["wood"], gltf_loc=(-1.0, 1.42, 0.1), bevel=0.03)
        make_box("M_CrateB", 0.55, 0.45, 0.55, mat=mats["terracotta"], gltf_loc=(0.95, 1.37, -0.05), bevel=0.03)
    protos["market-stall"] = capture(_market)

    # 5. Curved Wooden Harbor Sailboat with Cabin, Mast, Boom & Billowing Curved Sail
    def _boat():
        hull_poly = [(-3.4, 0.45), (-2.1, -0.55), (1.9, -0.55), (3.8, 0.72), (2.4, 0.95), (-2.9, 0.92)]
        make_extruded_poly("B_Hull", hull_poly, 2.5, mat=mats["wood"], gltf_quat=qax(0, 1, 0, math.pi * 0.5), bevel=0.14)
        make_box("B_Stripe", 2.62, 0.22, 5.4, mat=mats["red"], gltf_loc=(0, 0.68, 0.1), bevel=0.04)
        make_box("B_Cabin", 1.55, 0.85, 1.75, mat=mats["stucco"][0], gltf_loc=(0, 1.28, -0.8), bevel=0.08)
        make_tube("B_Mast", [(0, 0.85, 0.2), (0, 6.75, 0.2)], [0.13, 0.075], segments=10, mat=mats["wood"])
        make_tube("B_Boom", [(0, 1.85, 0.2), (0, 1.95, -2.5)], 0.075, segments=8, mat=mats["wood"])
        sail_poly = [(0.0, 1.95), (2.75, 2.15), (1.95, 4.35), (0.12, 6.45)]
        make_extruded_poly("B_Sail", sail_poly, 0.10, mat=mats["sail"], gltf_loc=(0, 0, 0.2), gltf_quat=qax(0, 1, 0, math.pi * 0.5), bevel=0.02)
    protos["boat"] = capture(_boat)

    # 6. Graceful Curved Palm Tree with Ringed Trunk, Coconuts & Arching Multi-Segment Fronds
    def _palm():
        make_tube(
            "P_Trunk",
            [(0, 0, 0), (0.28, 1.8, 0.08), (0.65, 3.8, -0.06), (0.95, 5.6, -0.18), (1.08, 6.75, -0.22)],
            [0.36, 0.30, 0.25, 0.21, 0.18],
            segments=10,
            mat=mats["wood"],
        )
        # Coconut cluster
        for ci in range(3):
            ca = ci * math.tau / 3.0
            make_sphere(f"P_Coco_{ci}", 0.22, mat=mats["wood"], gltf_loc=(1.08 + math.cos(ca) * 0.26, 6.42, -0.22 + math.sin(ca) * 0.26), segments=8, rings=6)
        # 7 gracefully drooping arching palm fronds
        for f in range(7):
            a = (f / 7.0) * math.tau
            dx, dz = math.sin(a), math.cos(a)
            pts = [
                (1.08, 6.72, -0.22),
                (1.08 + dx * 1.15, 7.25, -0.22 + dz * 1.15),
                (1.08 + dx * 2.25, 6.85, -0.22 + dz * 2.25),
                (1.08 + dx * 3.05, 5.85, -0.22 + dz * 3.05),
            ]
            make_tube(f"P_Frond_{f}", pts, [0.10, 0.36, 0.32, 0.06], segments=6, mat=mats["foliage"] if f % 2 == 0 else mats["foliage_alt"])
    protos["palm-tree"] = capture(_palm)

    # 7. Layered Sculpted Cypress Tree
    def _cypress():
        make_lathe("C_Trunk", [(0.34, 0.0), (0.24, 2.2)], segments=8, mat=mats["wood"])
        for tier, (y0, r0, r1, y1) in enumerate([(1.7, 1.35, 1.55, 3.6), (3.2, 1.22, 1.35, 5.4), (5.0, 0.92, 0.98, 7.2), (6.8, 0.55, 0.05, 8.8)]):
            make_lathe(f"C_Tier_{tier}", [(0.2, y0), (r0, y0 + 0.5), (r1, (y0 + y1) * 0.55), (0.06, y1)], segments=10, mat=mats["foliage"] if tier % 2 == 0 else mats["foliage_alt"])
    protos["cypress-tree"] = capture(_cypress)

    # 8. Faceted Coastal / Canyon Rock Formation
    def _rock():
        make_lathe("R_Main", [(3.8, 0.0), (3.4, 1.8), (2.6, 4.4), (1.4, 6.4), (0.4, 7.5)], segments=7, mat=mats["rock"], smooth=False)
        make_lathe("R_Side", [(2.1, 0.0), (1.8, 1.5), (0.9, 3.4), (0.2, 4.2)], segments=6, mat=mats["rock"], gltf_loc=(2.3, 0, 1.2), smooth=False)
    protos["rock-pillar"] = capture(_rock)

    # 9. Hero Coastal Lighthouse with Stone Base, Striped Tower, Gallery Deck, Glass Lantern Room & Red Dome
    def _lighthouse():
        make_lathe("LH_Base", [(4.8, 0.0), (4.5, 3.2), (4.2, 3.8)], segments=16, mat=mats["stone"])
        make_lathe("LH_Seg1", [(3.9, 3.6), (3.4, 9.6)], segments=16, mat=mats["stucco"][0])
        make_lathe("LH_Seg2", [(3.4, 9.6), (2.95, 15.2)], segments=16, mat=mats["red"])
        make_lathe("LH_Seg3", [(2.95, 15.2), (2.55, 20.4)], segments=16, mat=mats["stucco"][0])
        # Gallery deck & railing
        make_lathe("LH_Gallery", [(2.55, 20.1), (3.45, 20.5), (3.45, 21.1), (2.4, 21.1)], segments=16, mat=mats["iron"])
        # Glowing glass lantern room
        make_lathe("LH_Beacon", [(2.1, 21.0), (2.15, 23.6)], segments=14, mat=mats["lantern"])
        # Red conical roof cap & lightning rod
        make_lathe("LH_Cap", [(2.55, 23.5), (1.45, 25.0), (0.15, 26.4), (0.04, 27.6)], segments=14, mat=mats["red"])
    protos["lighthouse"] = capture(_lighthouse)

    # 10. Giant Ancient Fantasy Forest Tree (Bosque de Cristal)
    def _giant_tree():
        make_lathe("GT_Trunk", [(2.4, 0.0), (1.45, 2.5), (1.15, 8.8), (1.6, 11.4)], segments=10, mat=mats["wood"])
        # Flared buttress roots
        for ri in range(4):
            ra = ri * math.pi * 0.5 + 0.3
            make_tube(f"GT_Root_{ri}", [(0, 2.2, 0), (math.cos(ra) * 2.2, 0.8, math.sin(ra) * 2.2), (math.cos(ra) * 3.4, -0.2, math.sin(ra) * 3.4)], [0.65, 0.45, 0.25], segments=7, mat=mats["wood"])
        # Multi-lobe lush stylized canopy spheres
        for ci, (cx, cy, cz, cr) in enumerate([(0, 13.6, 0, 4.6), (-3.0, 12.2, 1.8, 3.2), (3.2, 12.6, -1.4, 3.3), (0.4, 16.0, 0.5, 3.1), (-1.8, 12.0, -2.5, 2.8)]):
            make_sphere(f"GT_Canopy_{ci}", cr, scale=(1.1, 0.78, 1.1), mat=mats["foliage"] if ci % 2 == 0 else mats["foliage_alt"], gltf_loc=(cx, cy, cz), segments=12, rings=8)
    protos["giant-tree"] = capture(_giant_tree)

    # 11. Crystal Clusters (Cyan & Magenta)
    for vi, cmat in enumerate((mats["crystal_cyan"], mats["crystal_magenta"])):
        def _crystal(cm=cmat):
            make_crystal_spire("CR_Main", 0.95, 5.4, sides=6, mat=cm, bevel=0.04)
            make_crystal_spire("CR_SideA", 0.68, 3.8, sides=6, mat=cm, gltf_loc=(1.05, 0, 0.55), gltf_quat=qax(0.2, 0, 1, -0.32), bevel=0.03)
            make_crystal_spire("CR_SideB", 0.62, 3.3, sides=6, mat=cm, gltf_loc=(-0.95, 0, -0.45), gltf_quat=qax(-0.2, 0, 1, 0.36), bevel=0.03)
            make_crystal_spire("CR_SideC", 0.52, 2.5, sides=6, mat=cm, gltf_loc=(0.25, 0, -0.95), gltf_quat=qax(1, 0, 0, 0.34), bevel=0.025)
        protos[f"crystal-cluster_{vi}"] = capture(_crystal)

    # 12. Waterfall Cliff
    def _waterfall():
        make_box("WF_CliffMain", 18.5, 22.5, 10.5, mat=mats["rock"], gltf_loc=(0, 10.5, 0), bevel=0.8, smooth=False)
        make_box("WF_Ledge", 20.5, 2.2, 11.5, mat=mats["foliage"], gltf_loc=(0, 21.8, 0), bevel=0.5)
        make_box("WF_Water", 8.6, 21.0, 1.0, mat=mats["water"], gltf_loc=(0, 10.3, 5.3), bevel=0.15)
        make_sphere("WF_Foam", 4.6, scale=(1.2, 0.38, 0.65), mat=mats["cloud"], gltf_loc=(0, 0.8, 5.9), segments=12, rings=8)
    protos["waterfall-cliff"] = capture(_waterfall)

    # 13. Bioluminescent Giant Mushroom Lamps (3 variants)
    for vi, cap_mat in enumerate((mats["crystal_cyan"], mats["crystal_magenta"], mats["lantern"])):
        def _shroom(cm=cap_mat):
            make_tube("MS_Stem", [(0, 0, 0), (0.12, 1.1, 0.05), (-0.06, 2.25, 0)], [0.34, 0.22, 0.24], segments=10, mat=mats["stucco"][0])
            make_lathe("MS_Cap", [(0.22, 2.15), (1.18, 2.22), (1.06, 2.65), (0.58, 3.05), (0.04, 3.18)], segments=14, mat=cm)
            for si in range(5):
                sa = si * math.tau / 5.0
                make_sphere(f"MS_Spot_{si}", 0.16, mat=mats["stucco"][0], gltf_loc=(math.cos(sa) * 0.72, 2.75, math.sin(sa) * 0.72), segments=8, rings=6)
        protos[f"mushroom-lamp_{vi}"] = capture(_shroom)

    # 14. Dutch Windmill Tower & Spinning Blades (EXACT WindmillBlades_<n> handled during placement!)
    def _windmill_tower():
        make_lathe("WM_Base", [(3.2, 0.0), (2.95, 2.0)], segments=12, mat=mats["stone"])
        make_lathe("WM_Tower", [(2.85, 1.8), (2.25, 5.8), (1.80, 9.4)], segments=12, mat=mats["stucco"][0])
        make_lathe("WM_Gallery", [(2.15, 5.6), (3.15, 5.8), (3.15, 6.2), (2.15, 6.2)], segments=12, mat=mats["wood"])
        make_lathe("WM_Cap", [(2.15, 9.2), (1.65, 10.6), (0.06, 12.0)], segments=12, mat=mats["terracotta"])
        make_box("WM_Door", 1.15, 2.1, 0.35, mat=mats["wood"], gltf_loc=(0, 1.1, 2.95), bevel=0.04)
        make_box("WM_Win", 0.85, 0.95, 0.25, mat=mats["lantern"], gltf_loc=(0, 4.4, 2.45), bevel=0.03)
        make_sphere("WM_HubNose", 0.42, mat=mats["wood"], gltf_loc=(0, 7.6, 2.15), segments=10, rings=8)
    protos["windmill_tower"] = capture(_windmill_tower)

    def _windmill_arm():
        make_box("WM_Spar", 0.20, 4.9, 0.16, mat=mats["wood"], gltf_loc=(0, 2.45, 0), bevel=0.02)
        make_box("WM_Sail", 0.92, 4.1, 0.08, mat=mats["sail"], gltf_loc=(0.38, 2.65, 0.02), bevel=0.02)
    protos["windmill_arm"] = capture(_windmill_arm)

    # 15. Classic Red Rural Barn with Gambrel Roof, Cross-Braced Doors & Hayloft
    def _barn():
        make_box("BN_Base", 9.0, 0.6, 7.6, mat=mats["stone"], gltf_loc=(0, 0.3, 0), bevel=0.06)
        make_box("BN_Body", 8.6, 5.0, 7.2, mat=mats["red"], gltf_loc=(0, 3.0, 0), bevel=0.08)
        gambrel = [(-4.8, 0.0), (4.8, 0.0), (3.5, 2.1), (0.0, 3.4), (-3.5, 2.1)]
        make_extruded_poly("BN_Roof", gambrel, 7.9, mat=mats["wood"], gltf_loc=(0, 5.4, 0), bevel=0.08, smooth=False)
        make_box("BN_DoorFrame", 3.1, 3.4, 0.22, mat=mats["stucco"][0], gltf_loc=(0, 2.0, 3.62), bevel=0.04)
        make_box("BN_DoorInner", 2.7, 3.1, 0.26, mat=mats["red"], gltf_loc=(0, 1.95, 3.63), bevel=0.03)
        make_box("BN_Loft", 1.35, 1.25, 0.24, mat=mats["lantern"], gltf_loc=(0, 6.2, 3.65), bevel=0.03)
    protos["barn"] = capture(_barn)

    # 16. Golden Hay Bale with Twine Rings
    def _hay():
        make_lathe("HB_Cyl", [(0.05, 0), (0.88, 0.05), (0.90, 0.7), (0.88, 1.35), (0.05, 1.4)], segments=12, mat=mats["hay"], gltf_loc=(0.7, 0.88, 0), gltf_quat=qax(0, 0, 1, math.pi * 0.5))
        for tx in (-0.35, 0.35):
            pts = [(tx, 0.88 + math.cos(i / 12 * math.tau) * 0.91, math.sin(i / 12 * math.tau) * 0.91) for i in range(12)]
            make_tube(f"HB_Twine_{tx}", pts, 0.035, segments=6, closed=True, mat=mats["wood"])
    protos["hay-bale"] = capture(_hay)

    # 17. Layered Alpine Pine Tree & Snow Pine Tree
    def _pine(with_snow=False):
        make_lathe("PN_Trunk", [(0.45, 0.0), (0.28, 3.0)], segments=8, mat=mats["wood"])
        tiers = [(2.0, 2.45, 4.9), (4.1, 1.95, 7.0), (6.1, 1.40, 9.2)]
        for i, (y0, r0, y1) in enumerate(tiers):
            make_lathe(f"PN_Tier_{i}", [(0.2, y0), (r0, y0 + 0.25), (0.08, y1)], segments=9, mat=mats["foliage"] if i != 1 else mats["foliage_alt"], smooth=False)
            if with_snow:
                make_lathe(f"PN_Snow_{i}", [(r0 * 0.72, y0 + (y1 - y0) * 0.45), (0.05, y1 + 0.14)], segments=9, mat=mats["snow"], smooth=False)
    protos["pine-tree"] = capture(lambda: _pine(False))
    protos["snow-pine"] = capture(lambda: _pine(True))

    # 18. Stratified Sandstone Mesa Arch (Cânion Solar)
    def _mesa_arch():
        for sx in (-12.5, 12.5):
            make_box(f"MA_Base_{sx}", 5.8, 4.5, 5.4, mat=mats["rock"], gltf_loc=(sx, 2.25, 0), bevel=0.45, smooth=False)
            make_box(f"MA_Mid_{sx}", 4.6, 9.5, 4.4, mat=mats["rock"], gltf_loc=(sx, 9.0, 0), bevel=0.35, smooth=False)
        make_box("MA_Span", 31.0, 3.8, 4.8, mat=mats["rock"], gltf_loc=(0, 14.5, 0), bevel=0.45, smooth=False)
        make_box("MA_Cap", 29.0, 1.2, 4.0, mat=mats["terracotta"], gltf_loc=(0, 16.6, 0), bevel=0.25, smooth=False)
    protos["mesa-arch"] = capture(_mesa_arch)

    # 19. Carved Sandstone Ruin Pillar
    def _ruin():
        make_box("RP_Base", 3.6, 1.4, 3.6, mat=mats["terracotta"], gltf_loc=(0, 0.7, 0), bevel=0.14)
        make_lathe("RP_Col", [(1.15, 1.3), (1.05, 9.3)], segments=10, mat=mats["rock"], smooth=False)
        make_box("RP_Cap", 3.2, 1.0, 3.2, mat=mats["terracotta"], gltf_loc=(0, 9.7, 0), bevel=0.12)
    protos["ruin-pillar"] = capture(_ruin)

    # 20. Ribbed Saguaro Cactus with Desert Blooms
    def _cactus():
        make_tube("CA_Body", [(0, 0, 0), (0, 3.9, 0)], [0.38, 0.34], segments=10, mat=mats["cactus"])
        make_tube("CA_ArmL", [(0, 1.7, 0), (-0.98, 1.9, 0), (-1.04, 3.25, 0)], [0.25, 0.24, 0.22], segments=8, mat=mats["cactus"])
        make_tube("CA_ArmR", [(0, 2.1, 0), (0.94, 2.3, 0), (0.98, 3.55, 0)], [0.24, 0.23, 0.20], segments=8, mat=mats["cactus"])
        make_sphere("CA_Bloom", 0.20, mat=mats["lantern"], gltf_loc=(0, 4.02, 0), segments=8, rings=6)
    protos["cactus"] = capture(_cactus)

    # 21. Carved Sun Totem
    def _sun_totem():
        make_box("ST_Base", 1.45, 0.65, 1.45, mat=mats["terracotta"], gltf_loc=(0, 0.32, 0), bevel=0.08)
        make_box("ST_Shaft", 0.96, 3.4, 0.96, mat=mats["rock"], gltf_loc=(0, 2.2, 0), bevel=0.10)
        make_crystal_spire("ST_Gem", 0.52, 1.25, sides=6, mat=mats["lantern"], gltf_loc=(0, 4.45, 0), double_ended=True, bevel=0.03)
    protos["sun-totem"] = capture(_sun_totem)

    # 22. Stepped Cyberpunk Neon Skyscrapers (3 color variants)
    for vi, gmat in enumerate((mats["crystal_cyan"], mats["neon_pink"], mats["neon_gold"])):
        def _sky(gm=gmat):
            make_box("SK_Lower", 12.2, 20.0, 12.2, mat=mats["skyscraper"], gltf_loc=(0, 10.0, 0), bevel=0.18)
            make_box("SK_Upper", 9.4, 18.0, 9.4, mat=mats["skyscraper"], gltf_loc=(0, 28.0, 0), bevel=0.15)
            make_lathe("SK_Spire", [(0.65, 37.0), (0.08, 45.0)], segments=8, mat=gm)
            for by, bw in ((8.0, 12.5), (15.0, 12.5), (20.2, 12.6), (28.0, 9.7), (36.5, 9.8)):
                make_box(f"SK_Band_{by}", bw, 0.85, bw, mat=gm, gltf_loc=(0, by, 0), bevel=0.04)
        protos[f"skyscraper_{vi}"] = capture(_sky)

    # 23. Curved Futuristic Neon Highway Arches (2 variants)
    for vi, gmat in enumerate((mats["crystal_cyan"], mats["neon_pink"])):
        def _narch(gm=gmat):
            hw = half_width + 1.5
            make_tube("NA_Frame", [(-hw, 0, 0), (-hw, 5.6, 0), (-hw * 0.65, 7.8, 0), (0, 8.5, 0), (hw * 0.65, 7.8, 0), (hw, 5.6, 0), (hw, 0, 0)], 0.45, segments=10, mat=mats["skyscraper"])
            make_tube("NA_Glow", [(-hw + 0.55, 0.4, 0), (-hw + 0.55, 5.4, 0), (-hw * 0.60, 7.3, 0), (0, 7.9, 0), (hw * 0.60, 7.3, 0), (hw - 0.55, 5.4, 0), (hw - 0.55, 0.4, 0)], 0.22, segments=8, mat=gm)
        protos[f"neon-arch_{vi}"] = capture(_narch)

    # 24. Holographic Neon Billboards (3 variants)
    for vi, gmat in enumerate((mats["crystal_cyan"], mats["neon_pink"], mats["crystal_magenta"])):
        def _nb(gm=gmat):
            make_box("NB_Post", 0.58, 5.6, 0.58, mat=mats["iron"], gltf_loc=(0, 2.8, 0), bevel=0.05)
            make_box("NB_Frame", 6.8, 3.2, 0.30, mat=mats["skyscraper"], gltf_loc=(0, 5.4, -0.04), bevel=0.06)
            make_box("NB_Glow", 6.3, 2.7, 0.36, mat=gm, gltf_loc=(0, 5.4, 0.02), bevel=0.04)
        protos[f"neon-billboard_{vi}"] = capture(_nb)

    # 25. Jagged Faceted Glacier Spire (Pico Boreal)
    def _glacier():
        make_crystal_spire("GL_Main", 4.9, 18.2, sides=6, mat=mats["ice"], bevel=0.14)
        make_crystal_spire("GL_SubA", 2.8, 11.4, sides=6, mat=mats["ice"], gltf_loc=(3.4, 0, 1.8), gltf_quat=qax(0, 0, 1, -0.22), bevel=0.10)
        make_crystal_spire("GL_SubB", 2.4, 9.6, sides=6, mat=mats["snow"], gltf_loc=(-3.0, 0, -1.6), gltf_quat=qax(0, 0, 1, 0.26), bevel=0.08)
    protos["glacier-spire"] = capture(_glacier)

    # 26. Nordic Aurora Crystal Pillars (2 variants)
    for vi, gmat in enumerate((mats["crystal_cyan"], mats["crystal_magenta"])):
        def _ap(gm=gmat):
            make_lathe("AP_Base", [(0.75, 0.0), (0.55, 0.65), (0.38, 4.2)], segments=8, mat=mats["ice"], smooth=False)
            make_crystal_spire("AP_Orb", 0.52, 1.35, sides=6, mat=gm, gltf_loc=(0, 4.95, 0), double_ended=True, bevel=0.03)
        protos[f"aurora-pillar_{vi}"] = capture(_ap)

    # 27. Floating Cloud Island (Jardim Celeste)
    def _cloud_island():
        make_lathe("CI_RockUnder", [(0.3, -6.2), (3.8, -2.5), (8.2, 0.2), (8.6, 1.4)], segments=10, mat=mats["rock"], smooth=False)
        make_lathe("CI_Turf", [(8.8, 1.4), (8.0, 2.7), (0.2, 3.2)], segments=12, mat=mats["grass"])
        for ci in range(6):
            ca = ci * math.tau / 6.0
            make_sphere(f"CI_Cloud_{ci}", 2.8, scale=(1.2, 0.65, 1.1), mat=mats["cloud"], gltf_loc=(math.cos(ca) * 7.8, 0.6, math.sin(ca) * 7.8), segments=10, rings=7)
    protos["cloud-island"] = capture(_cloud_island)

    # 28. Classical Marble Sky Gazebo with Gilded Ribbed Dome
    def _gazebo():
        make_lathe("GZ_Plinth", [(4.8, 0.0), (4.5, 0.55), (4.2, 0.85)], segments=12, mat=mats["marble"])
        for ci in range(6):
            ca = ci * math.tau / 6.0
            make_lathe(f"GZ_Col_{ci}", [(0.32, 0.8), (0.24, 4.8), (0.34, 5.05)], segments=10, mat=mats["marble"], gltf_loc=(math.cos(ca) * 3.5, 0, math.sin(ca) * 3.5))
        make_lathe("GZ_Entab", [(4.4, 4.95), (4.5, 5.45)], segments=12, mat=mats["marble"])
        make_lathe("GZ_Dome", [(4.35, 5.4), (3.5, 7.1), (1.8, 8.2), (0.12, 8.8), (0.04, 9.6)], segments=14, mat=mats["neon_gold"])
    protos["sky-gazebo"] = capture(_gazebo)

    # 29. Grand Golden Celestial Arch Ring
    def _sky_ring():
        pts = [(-10.2, 0, 0), (-8.6, 5.6, 0), (-4.4, 8.8, 0), (0, 9.8, 0), (4.4, 8.8, 0), (8.6, 5.6, 0), (10.2, 0, 0)]
        make_tube("SR_Arch", pts, 0.46, segments=10, mat=mats["neon_gold"])
        make_crystal_spire("SR_Keystone", 0.72, 1.8, sides=6, mat=mats["crystal_cyan"], gltf_loc=(0, 9.8, 0), double_ended=True, bevel=0.04)
    protos["sky-ring"] = capture(_sky_ring)

    # 30. Gothic Castle Tower with Crenellations, Buttresses, Steep Spire & Arcane Brazier (Fortaleza Tempestade)
    def _castle_tower():
        make_lathe("CT_Base", [(5.0, 0.0), (4.4, 3.0)], segments=8, mat=mats["fortress"], smooth=False)
        make_lathe("CT_Keep", [(4.3, 2.8), (3.9, 13.0)], segments=8, mat=mats["fortress"], smooth=False)
        make_lathe("CT_Parapet", [(4.7, 12.8), (4.7, 14.4)], segments=8, mat=mats["fortress"], smooth=False)
        # 8 crenellated battlements around parapet
        for bi in range(8):
            ba = bi * math.tau / 8.0
            make_box(f"CT_Merlon_{bi}", 1.15, 1.25, 0.85, mat=mats["fortress"], gltf_loc=(math.cos(ba) * 4.35, 14.95, math.sin(ba) * 4.35), gltf_quat=qax(0, 1, 0, -ba), bevel=0.06, smooth=False)
        make_lathe("CT_Spire", [(4.0, 14.2), (1.8, 18.2), (0.15, 21.0)], segments=8, mat=mats["iron"], smooth=False)
        make_crystal_spire("CT_Brazier", 0.85, 2.2, sides=6, mat=mats["crystal_magenta"], gltf_loc=(0, 21.8, 0), double_ended=True, bevel=0.04)
        # Glowing gothic lancet windows
        for wi in range(4):
            wa = wi * math.pi * 0.5
            make_box(f"CT_Win_{wi}", 0.75, 2.6, 0.25, mat=mats["crystal_magenta"], gltf_loc=(math.cos(wa) * 4.05, 8.6, math.sin(wa) * 4.05), gltf_quat=qax(0, 1, 0, -wa + math.pi * 0.5), bevel=0.04)
    protos["castle-tower"] = capture(_castle_tower)

    # 31. Monumental Gothic Storm Arch
    def _storm_arch():
        hw = half_width + 2.0
        for s in (-1, 1):
            make_box(f"SA_Pier_{s}", 2.6, 11.2, 3.0, mat=mats["fortress"], gltf_loc=(s * hw, 5.6, 0), bevel=0.14, smooth=False)
            make_crystal_spire(f"SA_Torch_{s}", 0.55, 1.6, sides=6, mat=mats["crystal_magenta"], gltf_loc=(s * hw, 12.1, 0), double_ended=True, bevel=0.03)
        make_box("SA_Lintel", hw * 2 + 2.8, 2.4, 3.0, mat=mats["fortress"], gltf_loc=(0, 10.6, 0), bevel=0.14, smooth=False)
        for mx in range(-int(hw), int(hw) + 1, 3):
            make_box(f"SA_Bat_{mx}", 1.2, 1.1, 1.4, mat=mats["fortress"], gltf_loc=(mx, 12.2, 0), bevel=0.06, smooth=False)
    protos["storm-arch"] = capture(_storm_arch)

    # 32. Tesla Iron Lightning Spire
    def _lightning_spire():
        make_lathe("LS_Base", [(1.15, 0.0), (0.85, 0.9), (0.45, 5.4)], segments=8, mat=mats["iron"], smooth=False)
        for cy in (2.8, 3.8, 4.7):
            pts = [(math.cos(i / 12 * math.tau) * 0.78, cy, math.sin(i / 12 * math.tau) * 0.78) for i in range(12)]
            make_tube(f"LS_Coil_{cy}", pts, 0.08, segments=6, closed=True, mat=mats["crystal_cyan"])
        make_sphere("LS_Orb", 0.56, mat=mats["crystal_cyan"], gltf_loc=(0, 5.95, 0), segments=12, rings=8)
    protos["lightning-spire"] = capture(_lightning_spire)

    # 33. Bridge Support Pier with Stone Capital
    def _bridge_pier():
        make_lathe("BP_Col", [(1.85, 0.0), (1.35, 1.6), (1.18, 13.2), (1.65, 14.3), (1.75, 14.6)], segments=10, mat=mats["stone"])
    protos["bridge_pier"] = capture(_bridge_pier)

    return protos


def instantiate_proto(name, parts, parent, gltf_loc, yaw=0.0, scale=1.0):
    holder = make_empty(name, gltf_loc=gltf_loc, parent=parent, gltf_quat=qax(0, 1, 0, yaw))
    holder.scale = (scale, scale, scale)
    for i, (mesh, loc_b, quat_b, scl_b) in enumerate(parts):
        child = bpy.data.objects.new(f"{name}_p{i}", mesh)
        child.location = loc_b
        child.rotation_mode = 'QUATERNION'
        child.rotation_quaternion = quat_b
        child.scale = scl_b
        bpy.context.scene.collection.objects.link(child)
        child.parent = holder
    return holder


def build_track(track_entry):
    reset_scene()
    biome = track_entry["biome"]
    layout = track_entry["layout"]
    pal = BIOME_PALETTES[biome]

    root = make_empty("TrackRoot")

    tex = lambda name: os.path.join(CACHE_DIR, f"{name}.png")

    mats = {
        "road": make_image_mat(f"{biome}_RoadAsphalt", tex("asphalt_albedo"), roughness_img_path=tex("asphalt_roughness"), roughness=0.28 if biome == "neon" else 0.86, metallic=0.18 if biome == "neon" else 0.05),
        "curb": make_image_mat(f"{biome}_Curb", tex(f"curb_{biome}"), roughness=0.68),
        "stone": make_image_mat(f"{biome}_StoneWall", tex("cobble"), color_tint=pal["wall"], roughness=0.82),
        "coping": make_pbr_mat(f"{biome}_WallCoping", color=pal["coping"], roughness=0.45 if biome == "neon" else 0.72, emissive=pal["coping"] if biome == "neon" else None, emissive_strength=0.9 if biome == "neon" else 0.0),
        "start_line": make_image_mat("StartCheckeredMat", tex("start_line"), roughness=0.52),
        "dirt": make_image_mat(f"{biome}_DirtMat", tex("dirt"), roughness=0.92),
        "sand": make_image_mat(f"{biome}_SandMat", tex("sand"), roughness=0.90),
        "grass": make_image_mat(f"{biome}_GrassMat", tex("grass"), roughness=0.92),
        "water": make_image_mat(f"{biome}_WaterMat", tex("water"), color_tint=pal["water"], roughness=0.16, metallic=0.15),
        "ice": make_image_mat(f"{biome}_IceMat", tex("ice"), roughness=0.12, metallic=0.10, coat=0.9),
        "terracotta": make_image_mat("TerracottaRoof", tex("terracotta"), roughness=0.72),
        "chevron": make_image_mat("ChevronBoardMat", tex("chevron"), roughness=0.34, emissive=(0.18, 0.04, 0.04), emissive_strength=0.35),
        "boost": make_image_mat("TrackBoostDeck", tex("boost_pad"), roughness=0.20, emissive=(0.18, 0.65, 1.0), emissive_strength=0.95),
        "snow": make_pbr_mat(f"{biome}_SnowMat", color=(0.88, 0.94, 0.99), roughness=0.78),
        "cloud": make_pbr_mat(f"{biome}_CloudSeaMat", color=(0.95, 0.97, 1.0), emissive=(0.14, 0.16, 0.22), emissive_strength=0.45, roughness=0.92),
        "stucco": [
            make_pbr_mat("StuccoCream", color=(0.96, 0.90, 0.78), roughness=0.84),
            make_pbr_mat("StuccoCoral", color=(0.95, 0.62, 0.46), roughness=0.80),
            make_pbr_mat("StuccoSeafoam", color=(0.66, 0.86, 0.84), roughness=0.80),
        ],
        "wood": make_pbr_mat("HarborTimber", color=(0.50, 0.31, 0.16), roughness=0.78),
        "iron": make_pbr_mat("WroughtIron", color=(0.15, 0.18, 0.24), metallic=0.72, roughness=0.36),
        "lantern": make_pbr_mat("LanternWarmGlow", color=(1.0, 0.84, 0.35), emissive=pal["tunnel_light"], emissive_strength=1.45, roughness=0.18),
        "ramp": make_pbr_mat(f"{biome}_RampMat", color=pal["ramp"], emissive=(0.24, 0.12, 0.02), emissive_strength=0.4, roughness=0.45, coat=0.4),
        "foliage": make_pbr_mat(f"{biome}_Foliage", color=pal["foliage"], roughness=0.80),
        "foliage_alt": make_pbr_mat(f"{biome}_FoliageAlt", color=pal["foliage_alt"], roughness=0.78),
        "sail": make_pbr_mat("SailCloth", color=(0.98, 0.95, 0.88), roughness=0.68, double_sided=True),
        "red": make_pbr_mat("LighthouseRed", color=(0.88, 0.20, 0.18), roughness=0.45, coat=0.3),
        "rock": make_pbr_mat(f"{biome}_Rock", color=pal["rock"], roughness=0.90),
        "crystal_cyan": make_pbr_mat("CrystalGlowCyan", color=(0.30, 0.92, 1.0), emissive=(0.20, 0.78, 0.96), emissive_strength=1.25, roughness=0.14, metallic=0.25, coat=0.9),
        "crystal_magenta": make_pbr_mat("CrystalGlowMagenta", color=(0.86, 0.38, 0.98), emissive=(0.68, 0.22, 0.92), emissive_strength=1.2, roughness=0.16, metallic=0.25, coat=0.9),
        "neon_pink": make_pbr_mat("NeonPinkGlow", color=(0.98, 0.24, 0.64), emissive=(0.98, 0.18, 0.58), emissive_strength=1.55, roughness=0.16),
        "neon_gold": make_pbr_mat("NeonGoldGlow", color=(0.98, 0.80, 0.20), emissive=(0.95, 0.72, 0.16), emissive_strength=0.95, metallic=0.68, roughness=0.22),
        "hay": make_pbr_mat("GoldenHay", color=(0.92, 0.74, 0.26), roughness=0.90),
        "cactus": make_pbr_mat("DesertSaguaro", color=(0.16, 0.56, 0.24), roughness=0.78),
        "skyscraper": make_pbr_mat("SkyscraperFacade", color=(0.07, 0.09, 0.18), metallic=0.58, roughness=0.28, coat=0.5),
        "marble": make_pbr_mat("SkyMarble", color=(0.96, 0.95, 0.98), roughness=0.34, coat=0.4),
        "fortress": make_pbr_mat("FortressSlate", color=(0.24, 0.23, 0.31), roughness=0.86),
        "tunnel": make_pbr_mat(f"{biome}_TunnelRock", color=pal["tunnel"], roughness=0.88, double_sided=True),
    }

    samples = layout["samples"]
    half_w = layout["halfWidth"]
    wall_m = layout["wallMargin"]

    # 1. Main road, 3D beveled curbs, and metric-UV retaining walls with coping stones
    build_road_and_curbs(samples, half_w, 1.18, True, mats["road"], mats["curb"], root, road_name="MainRoadMesh", make_curbs=True)
    build_wall_with_coping(samples, -wall_m, 1.38, 0.92, mats["stone"], mats["coping"], root, "LeftStoneWall")
    build_wall_with_coping(samples, wall_m, 1.38, 0.92, mats["stone"], mats["coping"], root, "RightStoneWall")

    # Surface overlay patches (dirt / sand / ice road stretches)
    total_len = layout["totalLength"]
    for zone in layout["surfaceZones"]:
        if zone["lateralMin"] > -half_w and zone["lateralMax"] < half_w:
            continue
        z_samples = [
            {
                "point": {"x": s["point"]["x"], "y": s["point"]["y"] + 0.025, "z": s["point"]["z"]},
                "right": s["right"],
            }
            for s in samples
            if min(abs(s["s"] - zone["centerS"]), total_len - abs(s["s"] - zone["centerS"])) <= zone["length"] * 0.5
        ]
        if len(z_samples) >= 4:
            pmat = mats["ice"] if zone["surface"] == "ice" else (mats["sand"] if zone["surface"] == "sand" else mats["dirt"])
            build_road_and_curbs(z_samples, half_w - 0.15, 0.0, False, pmat, mats["curb"], root, road_name=f"SurfacePatch_{zone['id']}", make_curbs=False)

    # Checkered start/finish line strip
    cp0 = layout["checkpoints"][0]
    make_uv_box("StartLineStrip", half_w * 1.96, 0.04, 3.8, 1, 1, mats["start_line"], root, (cp0["position"]["x"], cp0["position"]["y"] + 0.025, cp0["position"]["z"]), cp0["yaw"])

    # 2. Shortcut ribbons
    for sc in layout["shortcuts"]:
        sc_mat = mats.get(sc["surface"], mats["dirt"]) if sc["surface"] != "asphalt" else mats["road"]
        build_road_and_curbs(sc["samples"], sc["halfWidth"], 0.0, False, sc_mat, mats["curb"], root, road_name=f"Shortcut_{sc['id']}", make_curbs=False)

    # 3. Biome ground & water planes
    min_y = min(s["point"]["y"] for s in samples)
    floor_top_y = min_y - 6.5 if biome == "celeste" else min_y - 0.8
    if pal["has_water"]:
        make_uv_box("BayWaterPlane", 680, 0.2, 680, 26, 26, mats["water"], root, (0, floor_top_y - 0.9, 0))

    if biome == "porto":
        for lname, pos, sz, uv, lm in (
            ("LandStartSouth", (15, -1.45, 45), (120, 2.0, 155), (14, 18), mats["grass"]),
            ("LandHarborWest", (-145, -1.45, 55), (145, 2.0, 175), (16, 20), mats["grass"]),
            ("LandNorthRidge", (-95, -1.45, -145), (195, 2.0, 95), (22, 12), mats["grass"]),
            ("LandEastHeadland", (95, -1.45, 95), (110, 2.0, 130), (14, 16), mats["grass"]),
            ("SandCoveBeach", (-168, -1.25, 5), (58, 2.0, 105), (8, 14), mats["sand"]),
        ):
            make_uv_box(lname, sz[0], sz[1], sz[2], uv[0], uv[1], lm, root, pos)
    else:
        base_map = {"sand": mats["sand"], "snow": mats["snow"], "asphalt": mats["iron"], "cloud": mats["cloud"], "grass": mats["grass"]}
        make_uv_box("BiomeGroundBasin", 640, 1.4, 640, 28, 28, base_map[pal["base_surface"]], root, (0, floor_top_y - 0.7, 0))
        if biome in ("bosque", "vale", "boreal") and layout.get("bridgeRange"):
            br = layout["bridgeRange"]
            mid_s = (br["sStart"] + br["sEnd"]) * 0.5
            bmid = next((s for s in samples if s["s"] >= mid_s), None)
            if bmid:
                ryaw = math.atan2(bmid["right"]["x"], bmid["right"]["z"])
                make_uv_box("RiverChannelPlane", 46, 0.25, 260, 4, 18, mats["water"], root, (bmid["point"]["x"], floor_top_y + 0.12, bmid["point"]["z"]), ryaw)

    # Build instanced prototypes
    protos = build_scenery_prototypes(biome, pal, mats, half_w)

    # 4. Sculpted bridge support piers
    if layout.get("bridgeRange"):
        br = layout["bridgeRange"]
        b_samples = [s for s in samples if br["sStart"] <= s["s"] <= br["sEnd"]]
        for i in range(0, len(b_samples), 5):
            s = b_samples[i]
            for side in (-1, 1):
                px = s["point"]["x"] + s["right"]["x"] * side * (half_w + 0.5)
                py = s["point"]["y"] - 14.4
                pz = s["point"]["z"] + s["right"]["z"] * side * (half_w + 0.5)
                instantiate_proto(f"BridgePier_{i}_{side}", protos["bridge_pier"], root, (px, py, pz))

    # 5. Tunnel arch & ceiling light strip
    if layout.get("tunnelRange"):
        tr = layout["tunnelRange"]
        build_tunnel(samples, tr["sStart"], tr["sEnd"], half_w + 3.0, mats["tunnel"], mats["lantern"], root)

    # 6. High-Craft Start Gantry at Checkpoint 0 (EXACT node name TrackStartGantry)
    gantry = make_empty("TrackStartGantry", gltf_loc=(cp0["position"]["x"], cp0["position"]["y"], cp0["position"]["z"]), parent=root, gltf_quat=qax(0, 1, 0, cp0["yaw"]))
    gx = half_w + 1.25
    for side in (-1, 1):
        make_box(f"GantryPlinth_{side}", 1.5, 0.65, 1.5, mat=mats["neon_gold"], parent=gantry, gltf_loc=(side * gx, 0.32, 0), bevel=0.06)
        make_lathe(f"GantryPillar_{side}", [(0.52, 0.6), (0.38, 6.6)], segments=12, mat=mats["iron"], parent=gantry, gltf_loc=(side * gx, 0, 0))
    make_tube("GantryTrussTop", [(-gx - 0.4, 6.75, 0), (gx + 0.4, 6.75, 0)], 0.16, segments=10, mat=mats["iron"], parent=gantry)
    make_tube("GantryTrussBot", [(-gx - 0.4, 5.25, 0), (gx + 0.4, 5.25, 0)], 0.14, segments=10, mat=mats["iron"], parent=gantry)
    make_uv_box("GantryBanner", half_w * 2 + 1.4, 1.42, 0.44, 2, 1, mats["start_line"], gantry, (0, 6.0, 0))
    make_box("GantrySignalBox", 3.1, 0.78, 0.56, mat=mats["iron"], parent=gantry, gltf_loc=(0, 4.75, 0.08), bevel=0.06)
    for lx, lmat in ((-0.88, mats["red"]), (0.0, mats["lantern"]), (0.88, mats["crystal_cyan"])):
        make_sphere(f"GantryLamp_{lx:+.2f}", 0.22, scale=(1, 1, 0.5), mat=lmat, parent=gantry, gltf_loc=(lx, 4.75, 0.36), segments=10, rings=8)
    join_direct_mesh_children(gantry, "TrackStartGantryMesh")

    # 7. Detailed Boost Pads & Jump Ramps with Side Rails
    for pad in layout["boostPads"]:
        ph = make_empty(f"BoostPad_{pad['id']}", gltf_loc=(pad["position"]["x"], pad["position"]["y"] + 0.04, pad["position"]["z"]), parent=root, gltf_quat=qax(0, 1, 0, pad["yaw"]))
        make_box(f"BoostPadFrame_{pad['id']}", pad["width"] + 0.32, 0.08, pad["length"] + 0.25, mat=mats["iron"], parent=ph, bevel=0.02)
        make_uv_box(f"BoostPadDeck_{pad['id']}", pad["width"], 0.06, pad["length"], 1, 1, mats["boost"], ph, (0, 0.035, 0))
        join_direct_mesh_children(ph, f"BoostPad_{pad['id']}_Mesh")

    for ramp in layout["ramps"]:
        rh = make_empty(f"Ramp_{ramp['id']}", gltf_loc=(ramp["position"]["x"], ramp["position"]["y"], ramp["position"]["z"]), parent=root, gltf_quat=qax(0, 1, 0, ramp["yaw"]))
        rl, rw, rh_h = ramp["length"], ramp["width"], ramp["height"]
        # Uphill toward local -Z (matching buildRampMesh rotated +90 deg around Y)
        r_poly = [(-rl * 0.5, 0.0), (rl * 0.5, 0.0), (rl * 0.5, rh_h), (-rl * 0.5, 0.08)]
        make_extruded_poly(f"RampSlope_{ramp['id']}", r_poly, rw, mat=mats["ramp"], parent=rh, gltf_quat=qax(0, 1, 0, math.pi * 0.5), bevel=0.05)
        for side in (-1, 1):
            make_tube(
                f"RampRail_{ramp['id']}_{side}",
                [(side * (rw * 0.5 + 0.08), 0.16, rl * 0.48), (side * (rw * 0.5 + 0.08), rh_h + 0.16, -rl * 0.48)],
                0.09,
                segments=8,
                mat=mats["lantern"],
                parent=rh,
            )
        join_direct_mesh_children(rh, f"Ramp_{ramp['id']}_Mesh")

    # 8. Instanced Biome Scenery Group (EXACT node name SceneryGroup)
    scenery_group = make_empty("SceneryGroup", parent=root)
    wm_counter = 0

    for idx, item in enumerate(layout["scenery"]):
        kind = item["kind"]
        pos = (item["position"]["x"], item["position"]["y"], item["position"]["z"])
        yaw = item["yaw"]
        scale = item["scale"]
        var = item.get("variant", 0) or 0

        if kind == "lantern-post":
            instantiate_proto(f"Lantern_{idx}", protos["lantern-post"], scenery_group, pos, yaw, scale)
        elif kind == "chevron-board":
            instantiate_proto(f"Chevron_{idx}", protos["chevron-board"], scenery_group, pos, yaw, scale)
        elif kind == "house":
            instantiate_proto(f"House_{idx}", protos[f"house_{var % 3}"], scenery_group, pos, yaw, scale)
        elif kind == "market-stall":
            instantiate_proto(f"Market_{idx}", protos["market-stall"], scenery_group, pos, yaw, scale)
        elif kind == "boat":
            instantiate_proto(f"Boat_{idx}", protos["boat"], scenery_group, pos, yaw, scale)
        elif kind == "palm-tree":
            instantiate_proto(f"Palm_{idx}", protos["palm-tree"], scenery_group, pos, yaw, scale)
        elif kind == "cypress-tree":
            instantiate_proto(f"Cypress_{idx}", protos["cypress-tree"], scenery_group, pos, yaw, scale)
        elif kind == "rock-pillar":
            instantiate_proto(f"Rock_{idx}", protos["rock-pillar"], scenery_group, pos, yaw, scale)
        elif kind == "lighthouse":
            instantiate_proto(f"Lighthouse_{idx}", protos["lighthouse"], scenery_group, pos, yaw, scale)
        elif kind == "giant-tree":
            instantiate_proto(f"GiantTree_{idx}", protos["giant-tree"], scenery_group, pos, yaw, scale)
        elif kind == "crystal-cluster":
            instantiate_proto(f"Crystal_{idx}", protos[f"crystal-cluster_{var % 2}"], scenery_group, pos, yaw, scale)
        elif kind == "waterfall-cliff":
            instantiate_proto(f"Waterfall_{idx}", protos["waterfall-cliff"], scenery_group, pos, yaw, scale)
        elif kind == "mushroom-lamp":
            instantiate_proto(f"Mushroom_{idx}", protos[f"mushroom-lamp_{var % 3}"], scenery_group, pos, yaw, scale)
        elif kind == "windmill":
            wm_root = instantiate_proto(f"Windmill_{idx}", protos["windmill_tower"], scenery_group, pos, yaw, scale)
            blade_hub = make_empty(f"WindmillBlades_{wm_counter}", gltf_loc=(0.0, 7.6, 2.22), parent=wm_root)
            wm_counter += 1
            for b in range(4):
                arm_ang = b * math.pi * 0.5
                arm_holder = make_empty(f"WindmillArm_{idx}_{b}", parent=blade_hub, gltf_quat=qax(0, 0, 1, arm_ang))
                for p_i, (mesh, loc_b, quat_b, scl_b) in enumerate(protos["windmill_arm"]):
                    child = bpy.data.objects.new(f"WMA_{idx}_{b}_{p_i}", mesh)
                    child.location = loc_b
                    child.rotation_mode = 'QUATERNION'
                    child.rotation_quaternion = quat_b
                    child.scale = scl_b
                    bpy.context.scene.collection.objects.link(child)
                    child.parent = arm_holder
        elif kind == "barn":
            instantiate_proto(f"Barn_{idx}", protos["barn"], scenery_group, pos, yaw, scale)
        elif kind == "hay-bale":
            instantiate_proto(f"Hay_{idx}", protos["hay-bale"], scenery_group, pos, yaw, scale)
        elif kind == "pine-tree":
            instantiate_proto(f"Pine_{idx}", protos["pine-tree"], scenery_group, pos, yaw, scale)
        elif kind == "mesa-arch":
            instantiate_proto(f"MesaArch_{idx}", protos["mesa-arch"], scenery_group, pos, yaw, scale)
        elif kind == "ruin-pillar":
            instantiate_proto(f"RuinPillar_{idx}", protos["ruin-pillar"], scenery_group, pos, yaw, scale)
        elif kind == "cactus":
            instantiate_proto(f"Cactus_{idx}", protos["cactus"], scenery_group, pos, yaw, scale)
        elif kind == "sun-totem":
            instantiate_proto(f"SunTotem_{idx}", protos["sun-totem"], scenery_group, pos, yaw, scale)
        elif kind == "skyscraper":
            instantiate_proto(f"Skyscraper_{idx}", protos[f"skyscraper_{var % 3}"], scenery_group, pos, yaw, scale)
        elif kind == "neon-arch":
            instantiate_proto(f"NeonArch_{idx}", protos[f"neon-arch_{var % 2}"], scenery_group, pos, yaw, scale)
        elif kind == "neon-billboard":
            instantiate_proto(f"NeonBoard_{idx}", protos[f"neon-billboard_{var % 3}"], scenery_group, pos, yaw, scale)
        elif kind == "glacier-spire":
            instantiate_proto(f"Glacier_{idx}", protos["glacier-spire"], scenery_group, pos, yaw, scale)
        elif kind == "snow-pine":
            instantiate_proto(f"SnowPine_{idx}", protos["snow-pine"], scenery_group, pos, yaw, scale)
        elif kind == "aurora-pillar":
            instantiate_proto(f"AuroraPillar_{idx}", protos[f"aurora-pillar_{var % 2}"], scenery_group, pos, yaw, scale)
        elif kind == "cloud-island":
            instantiate_proto(f"CloudIsland_{idx}", protos["cloud-island"], scenery_group, pos, yaw, scale)
        elif kind == "sky-gazebo":
            instantiate_proto(f"SkyGazebo_{idx}", protos["sky-gazebo"], scenery_group, pos, yaw, scale)
        elif kind == "sky-ring":
            instantiate_proto(f"SkyRing_{idx}", protos["sky-ring"], scenery_group, pos, yaw, scale)
        elif kind == "castle-tower":
            instantiate_proto(f"CastleTower_{idx}", protos["castle-tower"], scenery_group, pos, yaw, scale)
        elif kind == "storm-arch":
            instantiate_proto(f"StormArch_{idx}", protos["storm-arch"], scenery_group, pos, yaw, scale)
        elif kind == "lightning-spire":
            instantiate_proto(f"LightningSpire_{idx}", protos["lightning-spire"], scenery_group, pos, yaw, scale)

    out_path = os.path.join(PUBLIC_DIR, "assets/tracks", track_entry["file"])
    # JPEG for opaque track textures keeps each track GLB compact (<1.2 MB) while preserving crisp detail!
    sz = export_glb(out_path, animated=False, image_format='JPEG')
    print(f"  [track] {track_entry['file']} ({sz // 1024} KB)")


def main():
    data_path = os.path.join(CACHE_DIR, "tracks_data.json")
    with open(data_path, "r", encoding="utf-8") as f:
        tracks = json.load(f)
    print(f"=== Building All {len(tracks)} Blender 4.5 Tracks ===")
    for entry in tracks:
        build_track(entry)
    print("=== Done All 8 Tracks ===")


if __name__ == "__main__":
    main()
