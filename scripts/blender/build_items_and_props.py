"""Blender 4.5 procedural generator for all 6 items, 4 track props, and 6 Cycles HUD item icons."""

import math
import os
import sys
import bpy
import bmesh
from mathutils import Quaternion, Vector

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
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
    make_loft,
    make_pbr_mat,
    make_sphere,
    make_tube,
    render_studio_badge_png,
    reset_scene,
)


def build_item_box():
    """Prismatic faceted crystal cube inside ornate beveled gold corner brackets + orbiting ring + 3D star core."""
    reset_scene()
    root = make_empty("ItemBoxRoot")

    shell_mat = make_pbr_mat(
        "ItemBoxCrystalShell",
        color=(0.24, 0.80, 1.0),
        metallic=0.18,
        roughness=0.10,
        emissive=(0.14, 0.55, 0.95),
        emissive_strength=0.65,
        coat=1.0,
        alpha=0.72,
    )
    gold_mat = make_pbr_mat(
        "ItemBoxGoldTrim",
        color=(1.0, 0.76, 0.14),
        metallic=0.82,
        roughness=0.22,
        emissive=(0.35, 0.22, 0.03),
        emissive_strength=0.35,
        coat=0.6,
    )
    core_mat = make_pbr_mat(
        "ItemBoxCoreStar",
        color=(1.0, 0.95, 0.42),
        metallic=0.35,
        roughness=0.14,
        emissive=(1.0, 0.82, 0.18),
        emissive_strength=1.45,
    )

    tilt = qax(1, 1, 0, 0.52)
    shell_group = make_empty("ItemBoxShell", parent=root, gltf_quat=tilt)

    # Faceted beveled crystal cube
    make_box("ShellCrystal", 1.02, 1.02, 1.02, mat=shell_mat, parent=shell_group, bevel=0.16, bevel_segments=3, smooth=False)

    # Ornate metallic frame bars along all 12 cube edges
    e = 0.52
    bar_r = 0.045
    edge_pairs = [
        ((-e, -e, -e), (e, -e, -e)), ((-e, e, -e), (e, e, -e)),
        ((-e, -e, e), (e, -e, e)), ((-e, e, e), (e, e, e)),
        ((-e, -e, -e), (-e, e, -e)), ((e, -e, -e), (e, e, -e)),
        ((-e, -e, e), (-e, e, e)), ((e, -e, e), (e, e, e)),
        ((-e, -e, -e), (-e, -e, e)), ((e, -e, -e), (e, -e, e)),
        ((-e, e, -e), (-e, e, e)), ((e, e, -e), (e, e, e)),
    ]
    for i, (p0, p1) in enumerate(edge_pairs):
        make_tube(f"FrameEdge_{i}", [p0, p1], bar_r, segments=8, mat=gold_mat, parent=shell_group)

    # Glowing corner studs
    idx = 0
    for sx in (-e, e):
        for sy in (-e, e):
            for sz in (-e, e):
                make_sphere(f"CornerStud_{idx}", 0.085, mat=gold_mat, parent=shell_group, gltf_loc=(sx, sy, sz), segments=10, rings=8)
                idx += 1

    # Twin tilted gyroscopic orbital rings
    ring_pts = [(math.cos(i / 28 * math.tau) * 0.88, 0.0, math.sin(i / 28 * math.tau) * 0.88) for i in range(28)]
    make_tube("ItemBoxRingA", ring_pts, 0.042, segments=10, closed=True, mat=gold_mat, parent=root, gltf_quat=qax(1, 0, 0.45, 0.62))
    ring_pts_b = [(math.cos(i / 24 * math.tau) * 0.78, 0.0, math.sin(i / 24 * math.tau) * 0.78) for i in range(24)]
    make_tube("ItemBoxRingB", ring_pts_b, 0.026, segments=8, closed=True, mat=core_mat, parent=root, gltf_quat=qax(-0.4, 0, 1, 0.85))

    # Sculpted 3D 6-point star crystal core
    core = make_empty("ItemBoxCore", parent=root)
    make_crystal_spire("CoreSpireY", 0.24, 0.72, sides=6, mat=core_mat, parent=core, double_ended=True, bevel=0.01)
    make_crystal_spire("CoreSpireX", 0.16, 0.56, sides=6, mat=core_mat, parent=core, gltf_quat=qax(0, 0, 1, math.pi * 0.5), double_ended=True, bevel=0.01)
    make_crystal_spire("CoreSpireZ", 0.16, 0.56, sides=6, mat=core_mat, parent=core, gltf_quat=qax(1, 0, 0, math.pi * 0.5), double_ended=True, bevel=0.01)

    join_direct_mesh_children(shell_group, "ItemBoxShellMesh")
    join_direct_mesh_children(core, "ItemBoxCoreMesh")
    join_direct_mesh_children(root, "ItemBoxRingsMesh")

    out = os.path.join(PUBLIC_DIR, "assets/props/item_box.glb")
    sz = export_glb(out)
    print(f"  [prop] item_box.glb ({sz // 1024} KB)")


def build_start_gantry():
    """High-detail steel lattice start gantry with checkered banner, hooded start lights, speakers & pennants."""
    reset_scene()
    root = make_empty("StartGantryRoot")

    steel_mat = make_pbr_mat("GantrySteel", color=(0.24, 0.29, 0.38), metallic=0.78, roughness=0.32, coat=0.3)
    dark_mat = make_pbr_mat("SpeakerHousing", color=(0.08, 0.10, 0.15), metallic=0.42, roughness=0.48)
    gold_mat = make_pbr_mat("GoldTrim", color=(0.98, 0.74, 0.12), metallic=0.72, roughness=0.25, coat=0.5)
    red_mat = make_pbr_mat("StartLightRed", color=(0.98, 0.14, 0.18), emissive=(0.98, 0.12, 0.14), emissive_strength=1.8, roughness=0.14)
    amber_mat = make_pbr_mat("StartLightAmber", color=(1.0, 0.70, 0.08), emissive=(1.0, 0.65, 0.06), emissive_strength=1.8, roughness=0.14)
    green_mat = make_pbr_mat("StartLightGreen", color=(0.12, 0.96, 0.45), emissive=(0.10, 0.90, 0.38), emissive_strength=1.8, roughness=0.14)
    banner_tex = os.path.join(PUBLIC_DIR, "assets/textures/start_line_albedo.png")
    banner_mat = make_image_mat("RaceBanner", banner_tex, roughness=0.42, metallic=0.08)

    for side_idx, px in enumerate((-7.8, 7.8)):
        side = "Left" if side_idx == 0 else "Right"
        # Stepped concrete & gold base plinth
        make_box(f"PillarPlinth_{side}", 1.65, 0.42, 1.65, mat=dark_mat, parent=root, gltf_loc=(px, 0.21, 0), bevel=0.06)
        make_box(f"PillarBase_{side}", 1.32, 0.48, 1.32, mat=gold_mat, parent=root, gltf_loc=(px, 0.62, 0), bevel=0.06)
        # Dual truss columns per side
        for dz in (-0.36, 0.36):
            make_lathe(
                f"PillarCol_{side}_{dz:+.1f}",
                [(0.24, 0.0), (0.20, 0.8), (0.18, 5.6), (0.26, 6.2)],
                segments=14,
                mat=steel_mat,
                parent=root,
                gltf_loc=(px, 0.82, dz),
            )
        # Cross rungs
        for ry in (1.8, 3.0, 4.2, 5.4):
            make_tube(f"PillarRung_{side}_{ry:.1f}", [(px, ry, -0.36), (px, ry, 0.36)], 0.055, segments=8, mat=gold_mat, parent=root)
        # Sculpted PA speaker pod
        make_box(f"SpeakerPod_{side}", 0.92, 1.35, 0.72, mat=dark_mat, parent=root, gltf_loc=(px * 0.89, 3.65, 0), bevel=0.07)
        make_sphere(f"SpeakerCone_{side}", 0.28, scale=(1.0, 1.0, 0.4), mat=gold_mat, parent=root, gltf_loc=(px * 0.89, 3.9, 0.34), segments=14, rings=8)
        # Top finial flag mast
        make_lathe(f"Finial_{side}", [(0.14, 0.0), (0.06, 1.4), (0.01, 1.6)], segments=10, mat=gold_mat, parent=root, gltf_loc=(px, 6.95, 0))

    # Overhead truss rails & diagonal bracing
    top_y, bot_y = 6.55, 5.45
    for label, yv, zv in (("TopF", top_y, 0.46), ("TopB", top_y, -0.46), ("BotF", bot_y, 0.46), ("BotB", bot_y, -0.46)):
        make_tube(f"TrussRail_{label}", [(-8.2, yv, zv), (8.2, yv, zv)], 0.11, segments=10, mat=steel_mat, parent=root)
    for seg in range(-7, 8, 2):
        make_tube(f"BraceF_{seg}", [(seg - 0.85, bot_y, 0.46), (seg + 0.85, top_y, 0.46)], 0.055, segments=8, mat=steel_mat, parent=root)
        make_tube(f"BraceB_{seg}", [(seg + 0.85, bot_y, -0.46), (seg - 0.85, top_y, -0.46)], 0.055, segments=8, mat=steel_mat, parent=root)

    # Checkered overhead race banner with gold frame
    make_box("BannerFrame", 13.0, 1.52, 0.26, mat=gold_mat, parent=root, gltf_loc=(0, 5.98, 0), bevel=0.05)
    make_box("StartBanner", 12.6, 1.28, 0.34, mat=banner_mat, parent=root, gltf_loc=(0, 5.98, 0), bevel=0.03)

    # Countdown signal housing with sun hoods and glowing lenses
    sig = make_empty("SignalHousing", gltf_loc=(0, 4.72, 0.06), parent=root)
    make_box("SignalBody", 3.1, 0.84, 0.56, mat=dark_mat, parent=sig, bevel=0.07)
    make_box("SignalTrim", 3.22, 0.12, 0.62, mat=gold_mat, parent=sig, gltf_loc=(0, 0.44, 0), bevel=0.03)
    for i, (lx, lmat) in enumerate(((-0.92, red_mat), (0.0, amber_mat), (0.92, green_mat))):
        make_sphere(f"SignalLamp_{i+1}", 0.24, scale=(1.0, 1.0, 0.55), mat=lmat, parent=sig, gltf_loc=(lx, 0, 0.27), segments=14, rings=10)
        make_lathe(
            f"SignalHood_{i+1}",
            [(0.27, 0.0), (0.28, 0.26), (0.24, 0.28)],
            segments=14,
            mat=dark_mat,
            parent=sig,
            gltf_loc=(lx, 0.03, 0.24),
            gltf_quat=qax(1, 0, 0, math.pi * 0.5),
            cap_top=False,
            cap_bottom=False,
        )

    out = os.path.join(PUBLIC_DIR, "assets/props/start_gantry.glb")
    sz = export_glb(out)
    print(f"  [prop] start_gantry.glb ({sz // 1024} KB)")


def build_chevron_board():
    """High-visibility turn-warning chevron sign with steel support frame and amber warning beacons."""
    reset_scene()
    root = make_empty("ChevronBoardRoot")

    post_mat = make_pbr_mat("SignPostSteel", color=(0.28, 0.33, 0.40), metallic=0.72, roughness=0.35)
    amber_mat = make_pbr_mat("WarningBeacon", color=(1.0, 0.72, 0.08), emissive=(1.0, 0.65, 0.05), emissive_strength=1.5, roughness=0.18)
    chev_tex = os.path.join(PUBLIC_DIR, "assets/textures/chevron_sign_albedo.png")
    sign_mat = make_image_mat("ChevronFace", chev_tex, roughness=0.32, emissive=(0.18, 0.04, 0.04), emissive_strength=0.35)

    for px, tag in ((-1.25, "L"), (1.25, "R")):
        make_box(f"PostBase_{tag}", 0.38, 0.14, 0.38, mat=post_mat, parent=root, gltf_loc=(px, 0.07, 0), bevel=0.02)
        make_tube(f"SignPost_{tag}", [(px, 0.1, 0), (px, 2.52, 0)], 0.08, segments=10, mat=post_mat, parent=root)
        make_sphere(f"Beacon_{tag}", 0.13, mat=amber_mat, parent=root, gltf_loc=(px, 2.66, 0), segments=12, rings=8)

    make_box("ChevronFrame", 3.74, 1.48, 0.14, mat=post_mat, parent=root, gltf_loc=(0, 1.85, -0.02), bevel=0.04)
    make_box("ChevronPanel", 3.58, 1.32, 0.16, mat=sign_mat, parent=root, gltf_loc=(0, 1.85, 0.01), bevel=0.03)

    out = os.path.join(PUBLIC_DIR, "assets/props/chevron_board.glb")
    sz = export_glb(out)
    print(f"  [prop] chevron_board.glb ({sz // 1024} KB)")


def build_boost_pad():
    """Sleek beveled turbo boost pad with side guide rails and glowing cyan-gold sculpted chevron strips."""
    reset_scene()
    root = make_empty("BoostPadRoot")

    frame_mat = make_pbr_mat("BoostFrame", color=(0.12, 0.16, 0.26), metallic=0.78, roughness=0.28, coat=0.4)
    cyan_glow = make_pbr_mat("BoostChevronGlow", color=(0.20, 0.92, 1.0), emissive=(0.15, 0.85, 1.0), emissive_strength=1.8, roughness=0.14)
    gold_glow = make_pbr_mat("BoostRailGlow", color=(1.0, 0.82, 0.18), emissive=(0.95, 0.68, 0.10), emissive_strength=1.3, roughness=0.18)

    make_box("BoostFrame", 2.75, 0.09, 4.15, mat=frame_mat, parent=root, gltf_loc=(0, 0.045, 0), bevel=0.03)
    deck = make_empty("BoostDeck", gltf_loc=(0, 0.085, 0), parent=root)
    make_box("DeckPlate", 2.30, 0.04, 3.75, mat=frame_mat, parent=deck, bevel=0.01)

    for side in (-1, 1):
        make_box(f"SideRail_{side}", 0.16, 0.11, 3.95, mat=gold_glow, parent=deck, gltf_loc=(side * 1.24, 0.04, 0), bevel=0.03)

    # 3 crisp raised glowing forward chevrons pointing -Z
    chev_poly = [(-0.92, 0.35), (0.0, -0.42), (0.92, 0.35), (0.92, 0.02), (0.0, -0.75), (-0.92, 0.02)]
    for i, cz in enumerate((-1.1, 0.0, 1.1)):
        c = make_extruded_poly(
            f"BoostChevron_{i}",
            chev_poly,
            0.045,
            mat=cyan_glow,
            parent=deck,
            gltf_loc=(0, 0.035, cz),
            gltf_quat=qax(1, 0, 0, math.pi * 0.5),
            bevel=0.008,
        )
        void = c

    out = os.path.join(PUBLIC_DIR, "assets/props/boost_pad.glb")
    sz = export_glb(out)
    print(f"  [prop] boost_pad.glb ({sz // 1024} KB)")


def build_pulso_solar():
    """Radiant multi-layered golden sun-core with curved flare fins and twin plasma gyro-rings."""
    reset_scene()
    root = make_empty("PulsoSolarRoot")

    core_mat = make_pbr_mat("SolarCoreMat", color=(1.0, 0.86, 0.20), emissive=(1.0, 0.65, 0.08), emissive_strength=1.7, roughness=0.14, metallic=0.25, coat=0.8)
    flare_mat = make_pbr_mat("SolarFlareMat", color=(1.0, 0.52, 0.06), emissive=(0.98, 0.40, 0.04), emissive_strength=1.2, roughness=0.22, metallic=0.45)
    gold_mat = make_pbr_mat("SolarGoldMat", color=(1.0, 0.82, 0.25), metallic=0.88, roughness=0.20, coat=0.5)

    make_sphere("SolarCore", 0.30, mat=core_mat, parent=root, segments=22, rings=16)

    # 8 sculpted solar corona rays
    for i in range(8):
        ang = (i / 8) * math.tau
        q = qax(0, 0, 1, ang)
        make_crystal_spire(
            f"SolarRay_{i}",
            0.095,
            0.42,
            sides=5,
            mat=flare_mat if i % 2 == 0 else core_mat,
            parent=root,
            gltf_loc=(math.cos(ang + math.pi * 0.5) * 0.24, math.sin(ang + math.pi * 0.5) * 0.24, 0),
            gltf_quat=q,
            bevel=0.012,
        )

    # Twin intersecting gyroscopic energy rings
    pts1 = [(math.cos(i / 28 * math.tau) * 0.50, 0.0, math.sin(i / 28 * math.tau) * 0.50) for i in range(28)]
    make_tube("SolarRingA", pts1, 0.044, segments=10, closed=True, mat=gold_mat, parent=root, gltf_quat=qax(1, 0, 0.5, 0.65))
    pts2 = [(math.cos(i / 24 * math.tau) * 0.42, 0.0, math.sin(i / 24 * math.tau) * 0.42) for i in range(24)]
    make_tube("SolarRingB", pts2, 0.032, segments=10, closed=True, mat=core_mat, parent=root, gltf_quat=qax(-0.6, 0, 1, 0.85))
    join_direct_mesh_children(root, "PulsoSolarMesh")

    out = os.path.join(PUBLIC_DIR, "assets/items/pulso_solar.glb")
    sz = export_glb(out)
    ico = render_studio_badge_png(
        os.path.join(PUBLIC_DIR, "assets/ui/item_pulso_solar.png"),
        cam_gltf_pos=(0.12, 0.42, -1.96),
        look_at_gltf=(0.0, 0.0, 0.0),
        lens_mm=46,
        size=128,
        bg_top_rgb=(0.95, 0.52, 0.06),
        bg_bot_rgb=(0.42, 0.14, 0.04),
        rim_rgb=(1.0, 0.82, 0.20),
        rim_light_color=(1.0, 0.80, 0.25),
    )
    print(f"  [item] pulso_solar.glb ({sz // 1024} KB) + icon ({ico // 1024} KB)")


def build_bolha_guardia():
    """Hexagonal energy shield emblem inside glowing dual-axis force-field rings and orbital nodes."""
    reset_scene()
    root = make_empty("BolhaGuardiaRoot")

    shield_mat = make_pbr_mat("GuardianShieldMat", color=(0.18, 0.78, 1.0), emissive=(0.10, 0.62, 1.0), emissive_strength=1.25, roughness=0.10, metallic=0.35, coat=1.0)
    core_mat = make_pbr_mat("GuardianCoreMat", color=(0.86, 0.97, 1.0), emissive=(0.45, 0.88, 1.0), emissive_strength=1.1, roughness=0.12, metallic=0.65)
    frame_mat = make_pbr_mat("GuardianFrameMat", color=(0.12, 0.36, 0.74), metallic=0.82, roughness=0.22, coat=0.6)

    # Sculpted heraldic shield emblem at center
    shield_poly = [
        (0.0, -0.34),
        (0.24, -0.14),
        (0.28, 0.20),
        (0.0, 0.32),
        (-0.28, 0.20),
        (-0.24, -0.14),
    ]
    make_extruded_poly("ShieldEmblem", shield_poly, 0.12, mat=frame_mat, parent=root, bevel=0.03)
    make_extruded_poly("ShieldCoreFace", [(x * 0.74, y * 0.74) for x, y in shield_poly], 0.145, mat=core_mat, parent=root, bevel=0.02)

    pts = [(math.cos(i / 28 * math.tau) * 0.48, 0.0, math.sin(i / 28 * math.tau) * 0.48) for i in range(28)]
    make_tube("ShieldEquator", pts, 0.048, segments=10, closed=True, mat=shield_mat, parent=root, gltf_quat=qax(1, 0, 0.2, 0.35))
    make_tube("ShieldMeridian", pts, 0.038, segments=10, closed=True, mat=core_mat, parent=root, gltf_quat=qax(0.3, 0, 1, 1.25))

    for i in range(4):
        a = i * math.pi * 0.5
        make_sphere(f"ShieldNode_{i}", 0.068, mat=core_mat, parent=root, gltf_loc=(math.cos(a) * 0.48, 0.0, math.sin(a) * 0.48), segments=10, rings=8)
    join_direct_mesh_children(root, "BolhaGuardiaMesh")

    out = os.path.join(PUBLIC_DIR, "assets/items/bolha_guardia.glb")
    sz = export_glb(out)
    ico = render_studio_badge_png(
        os.path.join(PUBLIC_DIR, "assets/ui/item_bolha_guardia.png"),
        cam_gltf_pos=(0.15, 0.22, -1.60),
        look_at_gltf=(0.0, 0.0, 0.0),
        lens_mm=48,
        size=128,
        bg_top_rgb=(0.06, 0.52, 0.85),
        bg_bot_rgb=(0.04, 0.18, 0.40),
        rim_rgb=(0.25, 0.82, 1.0),
        rim_light_color=(0.35, 0.88, 1.0),
    )
    print(f"  [item] bolha_guardia.glb ({sz // 1024} KB) + icon ({ico // 1024} KB)")


def build_nevoa_prisma():
    """Iridescent cluster of faceted magenta/violet prism crystals rising from a swirling mist cloud base."""
    reset_scene()
    root = make_empty("NevoaPrismaRoot")

    pink_mat = make_pbr_mat("PrismCloudPink", color=(0.96, 0.26, 0.64), emissive=(0.82, 0.14, 0.48), emissive_strength=1.15, roughness=0.16, metallic=0.22, coat=0.9)
    violet_mat = make_pbr_mat("PrismShardViolet", color=(0.62, 0.24, 0.98), emissive=(0.45, 0.14, 0.85), emissive_strength=1.05, roughness=0.14, metallic=0.28, coat=0.9)
    mist_mat = make_pbr_mat("PrismMistBase", color=(0.88, 0.65, 0.98), emissive=(0.42, 0.16, 0.52), emissive_strength=0.45, roughness=0.55)

    # Billowing mist cloud puffs at base
    puffs = [
        (0.0, 0.14, 0.0, 0.38),
        (-0.32, 0.12, 0.18, 0.28),
        (0.34, 0.13, -0.14, 0.29),
        (0.14, 0.11, 0.30, 0.26),
        (-0.22, 0.11, -0.26, 0.26),
    ]
    for i, (x, y, z, r) in enumerate(puffs):
        make_sphere(f"MistPuff_{i}", r, scale=(1.15, 0.62, 1.15), mat=mist_mat, parent=root, gltf_loc=(x, y, z), segments=14, rings=10)

    # Bursting angled prism crystal shards
    shards = [
        (0.0, 0.14, 0.0, 0.22, 0.78, (0, 0, 1), 0.0, pink_mat),
        (-0.26, 0.12, 0.16, 0.16, 0.58, (0.4, 0, 1), 0.34, violet_mat),
        (0.28, 0.14, -0.12, 0.17, 0.62, (-0.3, 0, 1), -0.32, violet_mat),
        (0.12, 0.12, 0.28, 0.14, 0.52, (1, 0, 0.3), 0.36, pink_mat),
        (-0.20, 0.12, -0.24, 0.15, 0.54, (1, 0, -0.4), -0.35, pink_mat),
    ]
    for i, (x, y, z, r, h, ax, ang, mat) in enumerate(shards):
        make_crystal_spire(f"PrismShard_{i}", r, h, sides=6, mat=mat, parent=root, gltf_loc=(x, y, z), gltf_quat=qax(*ax, ang), bevel=0.012)
    join_direct_mesh_children(root, "NevoaPrismaMesh")

    out = os.path.join(PUBLIC_DIR, "assets/items/nevoa_prisma.glb")
    sz = export_glb(out)
    ico = render_studio_badge_png(
        os.path.join(PUBLIC_DIR, "assets/ui/item_nevoa_prisma.png"),
        cam_gltf_pos=(0.2, 0.58, -1.62),
        look_at_gltf=(0.0, 0.34, 0.0),
        lens_mm=46,
        size=128,
        bg_top_rgb=(0.78, 0.14, 0.48),
        bg_bot_rgb=(0.28, 0.08, 0.45),
        rim_rgb=(0.95, 0.34, 0.68),
        rim_light_color=(0.98, 0.45, 0.85),
    )
    print(f"  [item] nevoa_prisma.glb ({sz // 1024} KB) + icon ({ico // 1024} KB)")


def build_faisca_rastreadora():
    """Sleek crimson-and-gold homing torpedo rocket oriented along -Z forward with seeker eye & thruster."""
    reset_scene()
    root = make_empty("FaiscaRastreadoraRoot")

    crimson_mat = make_pbr_mat("SeekerCrimson", color=(0.94, 0.16, 0.20), metallic=0.45, roughness=0.22, emissive=(0.45, 0.04, 0.06), emissive_strength=0.45, coat=0.8)
    gold_mat = make_pbr_mat("SeekerGold", color=(1.0, 0.78, 0.16), metallic=0.82, roughness=0.20, coat=0.5)
    eye_mat = make_pbr_mat("SeekerEye", color=(0.30, 0.96, 1.0), emissive=(0.20, 0.90, 1.0), emissive_strength=1.9, roughness=0.08)
    flame_mat = make_pbr_mat("SeekerFlame", color=(1.0, 0.72, 0.18), emissive=(1.0, 0.58, 0.08), emissive_strength=2.0, roughness=0.2)

    # Streamlined nose-to-tail fuselage pointing along -Z
    make_lathe(
        "SeekerBody",
        [
            (0.01, -0.66),
            (0.18, -0.52),
            (0.30, -0.24),
            (0.33, 0.06),
            (0.28, 0.34),
            (0.18, 0.52),
            (0.14, 0.56),
        ],
        segments=20,
        mat=crimson_mat,
        parent=root,
        gltf_quat=qax(1, 0, 0, math.pi * 0.5),
    )
    # Glowing target-lock seeker eye lens at nose (-Z)
    make_sphere("SeekerEyeLens", 0.15, scale=(1.0, 1.0, 0.65), mat=eye_mat, parent=root, gltf_loc=(0, 0, -0.56), segments=14, rings=10)
    # Gold turbine collar rings
    for rz in (-0.28, 0.22):
        pts = [(math.cos(i / 20 * math.tau) * 0.33, math.sin(i / 20 * math.tau) * 0.33, rz) for i in range(20)]
        make_tube(f"SeekerRing_{rz:+.2f}", pts, 0.036, segments=8, closed=True, mat=gold_mat, parent=root)

    # 3 swept golden delta stabilizer fins
    fin_poly = [(0.0, 0.22), (0.0, 0.54), (0.38, 0.62), (0.32, 0.36)]
    for i in range(3):
        ang = i * math.tau / 3.0
        q_rot = qax(0, 0, 1, ang) @ qax(0, 1, 0, math.pi * 0.5)
        make_extruded_poly(f"SeekerFin_{i}", fin_poly, 0.05, mat=gold_mat, parent=root, gltf_quat=q_rot, bevel=0.012)

    # Rear plasma thruster flame cone
    make_lathe(
        "SeekerThrusterFlame",
        [(0.13, 0.54), (0.16, 0.68), (0.01, 0.96)],
        segments=14,
        mat=flame_mat,
        parent=root,
        gltf_quat=qax(1, 0, 0, math.pi * 0.5),
    )
    join_direct_mesh_children(root, "FaiscaRastreadoraMesh")

    out = os.path.join(PUBLIC_DIR, "assets/items/faisca_rastreadora.glb")
    sz = export_glb(out)
    ico = render_studio_badge_png(
        os.path.join(PUBLIC_DIR, "assets/ui/item_faisca_rastreadora.png"),
        cam_gltf_pos=(1.42, 0.82, -1.42),
        look_at_gltf=(0.0, 0.0, 0.0),
        lens_mm=46,
        size=128,
        bg_top_rgb=(0.86, 0.16, 0.16),
        bg_bot_rgb=(0.38, 0.06, 0.08),
        rim_rgb=(1.0, 0.45, 0.14),
        rim_light_color=(1.0, 0.75, 0.30),
    )
    print(f"  [item] faisca_rastreadora.glb ({sz // 1024} KB) + icon ({ico // 1024} KB)")


def build_onda_de_vento():
    """Sculpted spiraling turquoise cyclone ribbons with glowing wind-crest blades."""
    reset_scene()
    root = make_empty("OndaDeVentoRoot")

    teal_mat = make_pbr_mat("WindTealMat", color=(0.14, 0.90, 0.80), emissive=(0.10, 0.72, 0.64), emissive_strength=1.15, roughness=0.16, coat=0.7)
    foam_mat = make_pbr_mat("WindFoamMat", color=(0.82, 1.0, 0.98), emissive=(0.45, 0.95, 0.90), emissive_strength=1.25, roughness=0.18)

    # 3 ascending helical cyclone ribbons
    for strand in range(3):
        phase = strand * (math.tau / 3.0)
        pts = []
        rads = []
        steps = 26
        for i in range(steps):
            t = i / (steps - 1)
            ang = phase + t * math.tau * 1.45
            rad = 0.12 + t * 0.42
            y = -0.34 + t * 0.72
            pts.append((math.cos(ang) * rad, y, math.sin(ang) * rad))
            rads.append(0.022 + math.sin(t * math.pi) * 0.042)
        make_tube(f"WindHelix_{strand}", pts, rads, segments=10, mat=teal_mat if strand < 2 else foam_mat, parent=root)

    # Glowing vortex core sphere
    make_sphere("WindCore", 0.13, mat=foam_mat, parent=root, gltf_loc=(0, 0.04, 0), segments=14, rings=10)
    join_direct_mesh_children(root, "OndaDeVentoMesh")

    out = os.path.join(PUBLIC_DIR, "assets/items/onda_de_vento.glb")
    sz = export_glb(out)
    ico = render_studio_badge_png(
        os.path.join(PUBLIC_DIR, "assets/ui/item_onda_de_vento.png"),
        cam_gltf_pos=(0.0, 0.52, -1.55),
        look_at_gltf=(0.0, 0.02, 0.0),
        lens_mm=46,
        size=128,
        bg_top_rgb=(0.06, 0.64, 0.58),
        bg_bot_rgb=(0.05, 0.24, 0.26),
        rim_rgb=(0.20, 0.92, 0.80),
        rim_light_color=(0.45, 1.0, 0.92),
    )
    print(f"  [item] onda_de_vento.glb ({sz // 1024} KB) + icon ({ico // 1024} KB)")


def build_cristal_de_salto():
    """Tall faceted amethyst jump crystal cluster with floating upward halo ring & golden spring collar."""
    reset_scene()
    root = make_empty("CristalDeSaltoRoot")

    amethyst_mat = make_pbr_mat("JumpCrystalMat", color=(0.68, 0.28, 1.0), emissive=(0.48, 0.16, 0.92), emissive_strength=1.25, metallic=0.22, roughness=0.10, coat=1.0)
    lilac_mat = make_pbr_mat("JumpCrystalBright", color=(0.88, 0.64, 1.0), emissive=(0.72, 0.42, 1.0), emissive_strength=1.35, roughness=0.12, coat=0.9)
    gold_mat = make_pbr_mat("JumpCollarGold", color=(1.0, 0.80, 0.20), metallic=0.85, roughness=0.20, coat=0.5)

    # Central double-terminated amethyst crystal
    make_crystal_spire("JumpCrystalSpire", 0.26, 1.08, sides=6, mat=amethyst_mat, parent=root, double_ended=True, bevel=0.015)
    # 2 flanking crystalline shards
    make_crystal_spire("JumpCrystalSideL", 0.14, 0.64, sides=6, mat=lilac_mat, parent=root, gltf_loc=(-0.22, -0.08, 0.06), gltf_quat=qax(0, 0, 1, 0.28), double_ended=True, bevel=0.01)
    make_crystal_spire("JumpCrystalSideR", 0.13, 0.58, sides=6, mat=lilac_mat, parent=root, gltf_loc=(0.22, -0.10, -0.05), gltf_quat=qax(0, 0, 1, -0.32), double_ended=True, bevel=0.01)

    # Golden levitation spring-ring around waist
    pts = [(math.cos(i / 24 * math.tau) * 0.42, -0.18 + (i / 24) * 0.12, math.sin(i / 24 * math.tau) * 0.42) for i in range(25)]
    make_tube("JumpSpringRing", pts, 0.040, segments=10, mat=gold_mat, parent=root)
    join_direct_mesh_children(root, "CristalDeSaltoMesh")

    out = os.path.join(PUBLIC_DIR, "assets/items/cristal_de_salto.glb")
    sz = export_glb(out)
    ico = render_studio_badge_png(
        os.path.join(PUBLIC_DIR, "assets/ui/item_cristal_de_salto.png"),
        cam_gltf_pos=(0.15, 0.25, -1.68),
        look_at_gltf=(0.0, 0.0, 0.0),
        lens_mm=46,
        size=128,
        bg_top_rgb=(0.56, 0.18, 0.88),
        bg_bot_rgb=(0.20, 0.05, 0.38),
        rim_rgb=(0.78, 0.48, 1.0),
        rim_light_color=(0.82, 0.55, 1.0),
    )
    print(f"  [item] cristal_de_salto.glb ({sz // 1024} KB) + icon ({ico // 1024} KB)")


def main():
    print("=== Building Blender 4.5 Props, Items & HUD Item Icons ===")
    build_item_box()
    build_start_gantry()
    build_chevron_board()
    build_boost_pad()
    build_pulso_solar()
    build_bolha_guardia()
    build_nevoa_prisma()
    build_faisca_rastreadora()
    build_onda_de_vento()
    build_cristal_de_salto()
    print("=== Done Props & Items ===")


if __name__ == "__main__":
    main()
