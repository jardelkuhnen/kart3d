"""Blender 4.5 procedural generator for all 8 structurally distinct high-craft Kart GLBs."""

import math
import os
import sys
import bpy
from mathutils import Quaternion

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
sys.path.insert(0, SCRIPT_DIR)

from blender_utils import (
    export_glb,
    gltf_axis_angle_to_blender_quat as qax,
    join_direct_mesh_children,
    make_box,
    make_crystal_spire,
    make_empty,
    make_extruded_poly,
    make_lathe,
    make_loft,
    make_pbr_mat,
    make_sphere,
    make_tube,
    reset_scene,
)

KART_SPECS = [
    {
        "id": "trilha-raposa",
        "slug": "trilha_raposa",
        "primary": (0.96, 0.42, 0.07),
        "secondary": (0.11, 0.14, 0.22),
        "trim": (0.99, 0.76, 0.14),
        "style": "rally",
        "rf": 0.27, "rr": 0.33, "wf": 0.26, "wr": 0.35,
    },
    {
        "id": "engrenagem-turbo",
        "slug": "engrenagem_turbo",
        "primary": (0.14, 0.38, 0.90),
        "secondary": (0.24, 0.29, 0.37),
        "trim": (0.96, 0.74, 0.12),
        "style": "armored-boiler",
        "rf": 0.30, "rr": 0.36, "wf": 0.28, "wr": 0.36,
    },
    {
        "id": "cometa-estelar",
        "slug": "cometa_estelar",
        "primary": (0.42, 0.16, 0.86),
        "secondary": (0.06, 0.08, 0.15),
        "trim": (0.18, 0.82, 0.99),
        "style": "star-dart",
        "rf": 0.25, "rr": 0.31, "wf": 0.23, "wr": 0.31,
    },
    {
        "id": "raiz-veloz",
        "slug": "raiz_veloz",
        "primary": (0.04, 0.56, 0.38),
        "secondary": (0.42, 0.22, 0.08),
        "trim": (0.64, 0.90, 0.20),
        "style": "forest-buggy",
        "rf": 0.31, "rr": 0.40, "wf": 0.29, "wr": 0.40,
    },
    {
        "id": "chave-mestra-gt",
        "slug": "chave_mestra_gt",
        "primary": (0.86, 0.12, 0.14),
        "secondary": (0.95, 0.96, 0.98),
        "trim": (0.10, 0.12, 0.17),
        "style": "classic-gt",
        "rf": 0.27, "rr": 0.33, "wf": 0.25, "wr": 0.33,
    },
    {
        "id": "brisa-corsaria",
        "slug": "brisa_corsaria",
        "primary": (0.04, 0.56, 0.68),
        "secondary": (0.76, 0.56, 0.32),
        "trim": (0.98, 0.42, 0.50),
        "style": "nautical-skiff",
        "rf": 0.25, "rr": 0.30, "wf": 0.23, "wr": 0.30,
    },
    {
        "id": "escorpiao-dourado",
        "slug": "escorpiao_dourado",
        "primary": (0.86, 0.46, 0.04),
        "secondary": (0.14, 0.13, 0.13),
        "trim": (0.99, 0.86, 0.24),
        "style": "dune-scorpion",
        "rf": 0.30, "rr": 0.38, "wf": 0.28, "wr": 0.38,
    },
    {
        "id": "lamina-glacial",
        "slug": "lamina_glacial",
        "primary": (0.04, 0.52, 0.84),
        "secondary": (0.88, 0.93, 0.98),
        "trim": (0.16, 0.88, 0.98),
        "style": "ice-blade",
        "rf": 0.25, "rr": 0.32, "wf": 0.24, "wr": 0.32,
    },
]


def add_wheel(parent, name, radius, width, tire_mat, rim_mat, hub_mat, brake_mat, style):
    """Build a detailed racing wheel whose spin axle is local X (centered at 0,0,0)."""
    wheel = make_empty(name, parent=parent)
    hw = width * 0.5
    q_axle = qax(0, 0, 1, math.pi * 0.5)

    # Rounded racing tire profile with deep sidewall shoulder
    tire_profile = [
        (radius * 0.56, -hw * 0.82),
        (radius * 0.62, -hw * 0.98),
        (radius * 0.86, -hw),
        (radius * 0.98, -hw * 0.78),
        (radius, -hw * 0.42),
        (radius, hw * 0.42),
        (radius * 0.98, hw * 0.78),
        (radius * 0.86, hw),
        (radius * 0.62, hw * 0.98),
        (radius * 0.56, hw * 0.82),
    ]
    make_lathe(f"{name}_Tire", tire_profile, segments=22, mat=tire_mat, parent=wheel, gltf_quat=q_axle, cap_top=False, cap_bottom=False)

    # Deep-dish sculpted alloy rim barrel
    rim_profile = [
        (0.01, -hw * 0.65),
        (radius * 0.58, -hw * 0.74),
        (radius * 0.61, -hw * 0.84),
        (radius * 0.55, -hw * 0.84),
        (radius * 0.52, -hw * 0.40),
        (radius * 0.52, hw * 0.40),
        (radius * 0.55, hw * 0.84),
        (radius * 0.61, hw * 0.84),
        (radius * 0.58, hw * 0.74),
        (0.01, hw * 0.65),
    ]
    make_lathe(f"{name}_Rim", rim_profile, segments=18, mat=rim_mat, parent=wheel, gltf_quat=q_axle)

    # 5 sculpted star spokes (visible on both sides)
    spoke_count = 6 if style in ("armored-boiler", "classic-gt") else 5
    for i in range(spoke_count):
        ang = (i / spoke_count) * math.tau
        q_spoke = qax(1, 0, 0, ang)
        make_box(
            f"{name}_Spoke_{i}",
            width * 0.88,
            radius * 0.50,
            radius * 0.14,
            mat=hub_mat,
            parent=wheel,
            gltf_loc=(0, math.cos(ang) * radius * 0.25, math.sin(ang) * radius * 0.25),
            gltf_quat=q_spoke,
            bevel=0.012,
        )

    # Center lock-nut cap & inner brake rotor
    make_lathe(
        f"{name}_CenterCap",
        [(0.01, -hw * 0.94), (radius * 0.18, -hw * 0.90), (radius * 0.18, hw * 0.90), (0.01, hw * 0.94)],
        segments=10,
        mat=brake_mat,
        parent=wheel,
        gltf_quat=q_axle,
    )

    # Chunky tread lugs for off-road / rally / desert / snow styles
    if style in ("rally", "forest-buggy", "dune-scorpion", "ice-blade"):
        lug_count = 10
        lug_h = 0.024 if style in ("forest-buggy", "dune-scorpion") else 0.014
        for i in range(lug_count):
            ang = (i / lug_count) * math.tau
            make_box(
                f"{name}_Lug_{i}",
                width * 0.74,
                lug_h * 2.0,
                radius * 0.16,
                mat=tire_mat,
                parent=wheel,
                gltf_loc=(0, math.cos(ang) * (radius - 0.005), math.sin(ang) * (radius - 0.005)),
                gltf_quat=qax(1, 0, 0, ang),
                bevel=0.004,
                smooth=False,
            )

    return wheel


def loft_nose_section(z: float, half_w: float, y_bot: float, y_top: float, crown=0.05):
    """8-point rounded cross-section ring at glTF Z for sleek lofted kart bodywork."""
    w8 = half_w * 0.84
    ym = (y_bot + y_top) * 0.5
    return [
        (-w8, y_bot, z),
        (0.0, y_bot - 0.015, z),
        (w8, y_bot, z),
        (half_w, ym, z),
        (w8, y_top, z),
        (0.0, y_top + crown, z),
        (-w8, y_top, z),
        (-half_w, ym, z),
    ]


def build_kart(spec):
    reset_scene()
    sid = spec["id"]
    style = spec["style"]

    kart_root = make_empty("KartRoot")
    chassis = make_empty("ChassisGroup", parent=kart_root)

    # Rich automotive PBR materials
    primary_mat = make_pbr_mat(f"{sid}_Primary", color=spec["primary"], metallic=0.42, roughness=0.22, coat=0.95, coat_roughness=0.08)
    secondary_mat = make_pbr_mat(f"{sid}_Secondary", color=spec["secondary"], metallic=0.28, roughness=0.42, coat=0.25)
    trim_mat = make_pbr_mat(f"{sid}_Trim", color=spec["trim"], metallic=0.68, roughness=0.22, coat=0.6)
    chrome_mat = make_pbr_mat(f"{sid}_Chrome", color=(0.86, 0.90, 0.94), metallic=0.94, roughness=0.14, coat=0.4)
    tire_mat = make_pbr_mat(f"{sid}_Tire", color=(0.08, 0.09, 0.11), metallic=0.04, roughness=0.84)
    leather_mat = make_pbr_mat(f"{sid}_SeatLeather", color=(0.12, 0.13, 0.16), metallic=0.05, roughness=0.58)
    headlight_mat = make_pbr_mat(f"{sid}_Headlight", color=(1.0, 0.97, 0.86), emissive=(1.0, 0.92, 0.65), emissive_strength=1.8, roughness=0.10)
    taillight_mat = make_pbr_mat(f"{sid}_Taillight", color=(0.98, 0.12, 0.16), emissive=(0.98, 0.10, 0.12), emissive_strength=1.6, roughness=0.14)
    exhaust_core_mat = make_pbr_mat(f"{sid}_ExhaustCore", color=(1.0, 0.48, 0.12), emissive=(0.95, 0.36, 0.06), emissive_strength=1.1, roughness=0.25)
    accent_glow_mat = make_pbr_mat(f"{sid}_AccentGlow", color=spec["trim"], emissive=spec["trim"], emissive_strength=1.45, roughness=0.14, coat=0.8)
    brake_mat = make_pbr_mat(f"{sid}_BrakeCaliper", color=(0.92, 0.18, 0.14), metallic=0.55, roughness=0.28)
    carbon_mat = make_pbr_mat(f"{sid}_Carbon", color=(0.07, 0.08, 0.11), metallic=0.32, roughness=0.34, coat=0.5)

    # Floor pan / carbon undertray with front splitter & rear diffuser
    make_box("Undertray", 1.10, 0.10, 2.26, mat=carbon_mat, parent=chassis, gltf_loc=(0, 0.21, 0.02), bevel=0.03)
    make_box("RearDiffuser", 0.98, 0.14, 0.30, mat=carbon_mat, parent=chassis, gltf_loc=(0, 0.24, 1.12), bevel=0.03)
    for fx in (-0.30, -0.10, 0.10, 0.30):
        make_box(f"DiffuserFin_{fx:+.2f}", 0.03, 0.16, 0.26, mat=trim_mat, parent=chassis, gltf_loc=(fx, 0.23, 1.16), bevel=0.008)

    # Sculpted Lofted Main Body Cowl — distinct per archetype!
    if style == "rally":
        cowl_secs = [
            loft_nose_section(-1.26, 0.30, 0.22, 0.34, 0.02),
            loft_nose_section(-0.96, 0.44, 0.22, 0.50, 0.06),
            loft_nose_section(-0.42, 0.46, 0.24, 0.58, 0.07),
            loft_nose_section(0.28, 0.46, 0.24, 0.54, 0.03),
            loft_nose_section(0.88, 0.48, 0.26, 0.72, 0.06),
            loft_nose_section(1.12, 0.38, 0.28, 0.62, 0.03),
        ]
    elif style == "armored-boiler":
        cowl_secs = [
            loft_nose_section(-1.22, 0.44, 0.24, 0.54, 0.04),
            loft_nose_section(-0.85, 0.50, 0.24, 0.64, 0.06),
            loft_nose_section(-0.25, 0.52, 0.24, 0.60, 0.03),
            loft_nose_section(0.42, 0.52, 0.24, 0.62, 0.04),
            loft_nose_section(1.06, 0.50, 0.26, 0.74, 0.06),
            loft_nose_section(1.16, 0.42, 0.28, 0.58, 0.03),
        ]
    elif style == "star-dart":
        cowl_secs = [
            loft_nose_section(-1.48, 0.12, 0.22, 0.28, 0.02),
            loft_nose_section(-1.05, 0.28, 0.21, 0.40, 0.05),
            loft_nose_section(-0.42, 0.38, 0.22, 0.52, 0.07),
            loft_nose_section(0.32, 0.42, 0.22, 0.52, 0.04),
            loft_nose_section(0.95, 0.40, 0.24, 0.60, 0.06),
            loft_nose_section(1.22, 0.24, 0.26, 0.44, 0.02),
        ]
    elif style == "forest-buggy":
        cowl_secs = [
            loft_nose_section(-1.16, 0.32, 0.32, 0.46, 0.03),
            loft_nose_section(-0.78, 0.44, 0.30, 0.56, 0.06),
            loft_nose_section(-0.22, 0.46, 0.28, 0.56, 0.04),
            loft_nose_section(0.45, 0.48, 0.28, 0.60, 0.05),
            loft_nose_section(1.02, 0.46, 0.32, 0.72, 0.06),
            loft_nose_section(1.10, 0.36, 0.34, 0.56, 0.03),
        ]
    elif style == "classic-gt":
        cowl_secs = [
            loft_nose_section(-1.34, 0.36, 0.22, 0.48, 0.06),
            loft_nose_section(-0.92, 0.46, 0.22, 0.58, 0.08),
            loft_nose_section(-0.35, 0.48, 0.22, 0.56, 0.05),
            loft_nose_section(0.38, 0.48, 0.22, 0.54, 0.04),
            loft_nose_section(1.04, 0.46, 0.24, 0.62, 0.07),
            loft_nose_section(1.20, 0.36, 0.26, 0.46, 0.04),
        ]
    elif style == "nautical-skiff":
        cowl_secs = [
            loft_nose_section(-1.44, 0.14, 0.44, 0.56, 0.03),
            loft_nose_section(-1.02, 0.38, 0.24, 0.50, 0.02),
            loft_nose_section(-0.35, 0.48, 0.22, 0.52, 0.01),
            loft_nose_section(0.45, 0.50, 0.22, 0.56, 0.02),
            loft_nose_section(1.04, 0.46, 0.24, 0.64, 0.03),
            loft_nose_section(1.14, 0.38, 0.28, 0.56, 0.02),
        ]
    elif style == "dune-scorpion":
        cowl_secs = [
            loft_nose_section(-1.18, 0.28, 0.30, 0.42, 0.03),
            loft_nose_section(-0.76, 0.40, 0.28, 0.52, 0.05),
            loft_nose_section(-0.12, 0.44, 0.26, 0.50, 0.03),
            loft_nose_section(0.55, 0.46, 0.26, 0.58, 0.05),
            loft_nose_section(1.06, 0.44, 0.30, 0.68, 0.05),
            loft_nose_section(1.14, 0.32, 0.34, 0.50, 0.02),
        ]
    else:  # ice-blade
        cowl_secs = [
            loft_nose_section(-1.46, 0.16, 0.18, 0.28, 0.02),
            loft_nose_section(-0.98, 0.34, 0.20, 0.44, 0.05),
            loft_nose_section(-0.36, 0.40, 0.22, 0.54, 0.06),
            loft_nose_section(0.38, 0.42, 0.22, 0.54, 0.04),
            loft_nose_section(1.02, 0.42, 0.24, 0.60, 0.06),
            loft_nose_section(1.20, 0.28, 0.26, 0.44, 0.03),
        ]

    make_loft("MainCowl", cowl_secs, mat=primary_mat, parent=chassis, subsurf=1)

    # Center racing stripe / trim crest along nose
    make_box("HoodStripe", 0.18, 0.06, 0.78, mat=trim_mat, parent=chassis, gltf_loc=(0, 0.54, -0.72), gltf_quat=qax(1, 0, 0, 0.18), bevel=0.02)

    # Archetype-specific hero bodywork & structural silhouette
    if style == "rally":
        # Sculpted aerodynamic sidepods with intake grilles + rally hood scoop + dual-pillar GT wing + fog lights
        for side in (-1, 1):
            make_box(f"SidePod_{side}", 0.32, 0.26, 1.24, mat=primary_mat, parent=chassis, gltf_loc=(side * 0.56, 0.34, 0.06), bevel=0.07)
            make_box(f"SideIntake_{side}", 0.22, 0.16, 0.10, mat=carbon_mat, parent=chassis, gltf_loc=(side * 0.56, 0.34, -0.54), bevel=0.02)
            make_box(f"SideStripe_{side}", 0.34, 0.065, 1.06, mat=trim_mat, parent=chassis, gltf_loc=(side * 0.56, 0.39, 0.08), bevel=0.02)
            # Wing struts & endplates
            make_box(f"WingStrut_{side}", 0.06, 0.42, 0.22, mat=carbon_mat, parent=chassis, gltf_loc=(side * 0.40, 0.80, 0.98), gltf_quat=qax(1, 0, 0, -0.18), bevel=0.015)
            make_box(f"WingEndplate_{side}", 0.05, 0.28, 0.44, mat=primary_mat, parent=chassis, gltf_loc=(side * 0.70, 1.02, 1.02), bevel=0.015)
        make_box("HoodScoop", 0.26, 0.12, 0.34, mat=secondary_mat, parent=chassis, gltf_loc=(0, 0.60, -0.62), bevel=0.03)
        make_box("RearSpoilerWing", 1.40, 0.07, 0.34, mat=trim_mat, parent=chassis, gltf_loc=(0, 1.02, 1.02), gltf_quat=qax(1, 0, 0, 0.14), bevel=0.025)
        # Twin rally bumper fog lights
        for side in (-1, 1):
            make_sphere(f"RallyFog_{side}", 0.08, scale=(1, 1, 0.5), mat=headlight_mat, parent=chassis, gltf_loc=(side * 0.20, 0.34, -1.26), segments=12, rings=8)

    elif style == "armored-boiler":
        # Heavy riveted front bumper ram + brass pressurized copper boiler + pressure gauge + armored side skirts
        make_box("HeavyRam", 1.54, 0.26, 0.24, mat=trim_mat, parent=chassis, gltf_loc=(0, 0.34, -1.26), bevel=0.05)
        for rx in (-0.56, -0.28, 0.0, 0.28, 0.56):
            make_sphere(f"RamRivet_{rx:+.2f}", 0.035, mat=chrome_mat, parent=chassis, gltf_loc=(rx, 0.34, -1.38), segments=8, rings=6)
        # Horizontal cylindrical brass boiler tank behind driver
        make_lathe(
            "BoilerTank",
            [(0.01, -0.44), (0.30, -0.42), (0.36, -0.30), (0.36, 0.30), (0.30, 0.42), (0.01, 0.44)],
            segments=18,
            mat=trim_mat,
            parent=chassis,
            gltf_loc=(0, 0.80, 0.86),
            gltf_quat=qax(0, 0, 1, math.pi * 0.5),
        )
        for bx in (-0.28, 0.28):
            pts = [(bx, 0.80 + math.cos(i / 18 * math.tau) * 0.37, 0.86 + math.sin(i / 18 * math.tau) * 0.37) for i in range(18)]
            make_tube(f"BoilerBand_{bx:+.2f}", pts, 0.025, segments=8, closed=True, mat=secondary_mat, parent=chassis)
        make_sphere("PressureGauge", 0.11, scale=(1, 1, 0.45), mat=headlight_mat, parent=chassis, gltf_loc=(0, 0.96, 0.52), segments=12, rings=8)
        for side in (-1, 1):
            make_box(f"ArmorSide_{side}", 0.28, 0.36, 1.18, mat=secondary_mat, parent=chassis, gltf_loc=(side * 0.58, 0.40, 0.06), bevel=0.04)
            make_box(f"ArmorTrim_{side}", 0.30, 0.08, 1.10, mat=trim_mat, parent=chassis, gltf_loc=(side * 0.58, 0.54, 0.06), bevel=0.02)

    elif style == "star-dart":
        # Swept delta wings + glowing cyan plasma rails + sleek tall dorsal fin + ion ring wing
        for side in (-1, 1):
            wing_poly = [(0.0, 0.0), (side * 0.72, 0.38), (side * 0.76, 0.68), (0.0, 0.78)]
            make_extruded_poly(
                f"DeltaWing_{side}",
                [(x, -z) for x, z in wing_poly] if side > 0 else list(reversed([(x, -z) for x, z in wing_poly])),
                0.075,
                mat=primary_mat,
                parent=chassis,
                gltf_loc=(side * 0.24, 0.36, 0.02),
                gltf_quat=qax(1, 0, 0, math.pi * 0.5),
                bevel=0.02,
            )
            make_tube(
                f"WingPlasmaRail_{side}",
                [(side * 0.34, 0.38, -0.34), (side * 0.96, 0.40, 0.28), (side * 0.96, 0.44, 0.88)],
                0.042,
                segments=10,
                mat=accent_glow_mat,
                parent=chassis,
            )
            make_box(f"WingTipFin_{side}", 0.045, 0.34, 0.52, mat=secondary_mat, parent=chassis, gltf_loc=(side * 0.98, 0.52, 0.62), bevel=0.015)
        fin_poly = [(0.0, 0.0), (0.68, 0.0), (0.86, 0.54), (0.34, 0.58)]
        make_extruded_poly("CenterFin", fin_poly, 0.065, mat=trim_mat, parent=chassis, gltf_loc=(0, 0.56, 0.44), gltf_quat=qax(0, 1, 0, -math.pi * 0.5), bevel=0.015)

    elif style == "forest-buggy":
        # High-clearance tubular timber-metal rollcage + roof rally lightbar + front skid plate & bullbar
        make_tube(
            "TimberRollcageA",
            [(-0.46, 0.46, -0.46), (-0.42, 1.40, -0.02), (0.42, 1.40, -0.02), (0.46, 0.46, -0.46)],
            0.052,
            segments=10,
            mat=secondary_mat,
            parent=chassis,
        )
        make_tube(
            "TimberRollcageB",
            [(-0.42, 1.40, -0.02), (-0.44, 1.32, 0.72), (-0.46, 0.56, 0.92)],
            0.046,
            segments=10,
            mat=secondary_mat,
            parent=chassis,
        )
        make_tube(
            "TimberRollcageC",
            [(0.42, 1.40, -0.02), (0.44, 1.32, 0.72), (0.46, 0.56, 0.92)],
            0.046,
            segments=10,
            mat=secondary_mat,
            parent=chassis,
        )
        make_tube("RollcageCrossTop", [(-0.44, 1.32, 0.72), (0.44, 1.32, 0.72)], 0.042, segments=8, mat=secondary_mat, parent=chassis)
        make_box("LightbarHousing", 0.76, 0.11, 0.14, mat=carbon_mat, parent=chassis, gltf_loc=(0, 1.46, -0.02), bevel=0.03)
        for lx in (-0.26, -0.09, 0.09, 0.26):
            make_sphere(f"RoofLamp_{lx:+.2f}", 0.052, scale=(1, 1, 0.5), mat=headlight_mat, parent=chassis, gltf_loc=(lx, 1.46, -0.09), segments=10, rings=8)
        # Front bullbar & skid plate
        make_box("FrontSkid", 0.72, 0.07, 0.42, mat=chrome_mat, parent=chassis, gltf_loc=(0, 0.28, -1.16), gltf_quat=qax(1, 0, 0, 0.45), bevel=0.02)
        for side in (-1, 1):
            make_box(f"SideStep_{side}", 0.22, 0.14, 1.05, mat=trim_mat, parent=chassis, gltf_loc=(side * 0.54, 0.36, 0.06), bevel=0.03)

    elif style == "classic-gt":
        # Vintage Le Mans chrome radiator grille + sculpted arched wheel fenders + twin chrome roll-hoops + ducktail
        make_box("RadiatorFrame", 0.58, 0.32, 0.12, mat=chrome_mat, parent=chassis, gltf_loc=(0, 0.38, -1.32), bevel=0.04)
        for gx in (-0.20, -0.10, 0.0, 0.10, 0.20):
            make_box(f"GrilleBar_{gx:+.2f}", 0.024, 0.24, 0.14, mat=carbon_mat, parent=chassis, gltf_loc=(gx, 0.38, -1.33), bevel=0.004)
        for fx, fz, rr in ((-0.82, -0.84, 0.35), (0.82, -0.84, 0.35), (-0.86, 0.82, 0.41), (0.86, 0.82, 0.41)):
            pts = [(fx, 0.24 + math.sin(a) * rr, fz - math.cos(a) * rr) for a in (0.35, 0.9, 1.57, 2.24, 2.79)]
            make_tube(f"FenderArch_{fx:+.1f}_{fz:+.1f}", pts, 0.09, segments=10, mat=primary_mat, parent=chassis)
        make_box("DucktailWing", 1.12, 0.18, 0.26, mat=secondary_mat, parent=chassis, gltf_loc=(0, 0.68, 1.14), gltf_quat=qax(1, 0, 0, -0.25), bevel=0.05)
        make_tube("VintageRollHoop", [(-0.28, 0.62, 0.56), (-0.22, 1.02, 0.58), (0.22, 1.02, 0.58), (0.28, 0.62, 0.56)], 0.038, segments=10, mat=chrome_mat, parent=chassis)

    elif style == "nautical-skiff":
        # Sweeping wooden ship gunwales + brass bowsprit & prow ring + twin tilted stern rudders + side portholes
        make_tube("Bowsprit", [(0, 0.52, -1.25), (0, 0.66, -1.62)], [0.055, 0.025], segments=10, mat=secondary_mat, parent=chassis)
        bow_ring_pts = [(math.cos(i / 16 * math.tau) * 0.11, 0.52 + math.sin(i / 16 * math.tau) * 0.11, -1.46) for i in range(16)]
        make_tube("BowRing", bow_ring_pts, 0.024, segments=8, closed=True, mat=trim_mat, parent=chassis)
        for side in (-1, 1):
            make_tube(
                f"Gunwale_{side}",
                [(side * 0.22, 0.56, -1.32), (side * 0.50, 0.54, -0.55), (side * 0.52, 0.56, 0.45), (side * 0.46, 0.64, 1.08)],
                0.055,
                segments=10,
                mat=secondary_mat,
                parent=chassis,
            )
            # Twin angled rudder tailfins
            make_box(f"SternRudder_{side}", 0.06, 0.54, 0.38, mat=trim_mat, parent=chassis, gltf_loc=(side * 0.44, 0.86, 1.04), gltf_quat=qax(0, 0, 1, -side * 0.24), bevel=0.02)
            # Brass portholes along hull side
            for pz in (-0.30, 0.18):
                make_sphere(f"Porthole_{side}_{pz:+.1f}", 0.075, scale=(0.4, 1, 1), mat=trim_mat, parent=chassis, gltf_loc=(side * 0.50, 0.38, pz), segments=10, rings=8)

    elif style == "dune-scorpion":
        # Aggressive segmented scorpion-tail overhead spine + roof intake scoop + twin side sand-rails + V6 headers
        make_tube(
            "ScorpionSpine",
            [(0, 0.50, -0.82), (0, 0.46, 0.94), (0, 1.38, 1.02), (0, 1.54, 0.48), (0, 1.46, 0.08)],
            [0.055, 0.068, 0.062, 0.054, 0.044],
            segments=10,
            mat=trim_mat,
            parent=chassis,
        )
        make_box("AirScoop", 0.44, 0.22, 0.40, mat=primary_mat, parent=chassis, gltf_loc=(0, 1.50, 0.14), bevel=0.05)
        make_box("AirScoopMouth", 0.34, 0.12, 0.08, mat=carbon_mat, parent=chassis, gltf_loc=(0, 1.50, -0.06), bevel=0.015)
        for side in (-1, 1):
            make_tube(
                f"SandRail_{side}",
                [(side * 0.44, 0.36, -0.92), (side * 0.56, 0.44, -0.10), (side * 0.56, 0.56, 0.88), (side * 0.22, 1.32, 0.96)],
                0.042,
                segments=8,
                mat=secondary_mat,
                parent=chassis,
            )

    else:  # ice-blade
        # Razor front ski-blade outriggers + translucent icy crystal rear aero fins + frosted air vents
        ice_fin_mat = make_pbr_mat(f"{sid}_IceCrystalFin", color=(0.45, 0.94, 1.0), emissive=(0.18, 0.72, 0.98), emissive_strength=0.95, roughness=0.08, metallic=0.15, coat=1.0)
        for side in (-1, 1):
            make_tube(
                f"FrontSki_{side}",
                [(side * 0.54, 0.14, -0.58), (side * 0.54, 0.13, -1.26), (side * 0.54, 0.24, -1.52)],
                [0.055, 0.055, 0.032],
                segments=8,
                mat=secondary_mat,
                parent=chassis,
            )
            make_box(f"SkiBladeBase_{side}", 0.18, 0.04, 0.92, mat=trim_mat, parent=chassis, gltf_loc=(side * 0.54, 0.12, -1.04), bevel=0.01)
            make_crystal_spire(f"IceFin_{side}", 0.12, 0.62, sides=5, mat=ice_fin_mat, parent=chassis, gltf_loc=(side * 0.46, 0.58, 0.92), gltf_quat=qax(1, 0, 0, -0.35), bevel=0.01)
            make_box(f"SideIceVent_{side}", 0.24, 0.20, 0.96, mat=secondary_mat, parent=chassis, gltf_loc=(side * 0.50, 0.36, 0.12), bevel=0.05)

    # Front curved tubular bumper + LED Headlights + Rear Brake Lights
    make_tube(
        "FrontBumper",
        [(-0.70, 0.24, -0.98), (-0.58, 0.24, -1.26), (0.0, 0.25, -1.30), (0.58, 0.24, -1.26), (0.70, 0.24, -0.98)],
        0.048,
        segments=10,
        mat=trim_mat,
        parent=chassis,
    )
    for side, tag in ((-1, "L"), (1, "R")):
        make_lathe(
            f"HeadlightBezel_{tag}",
            [(0.095, 0.0), (0.098, 0.09), (0.08, 0.11)],
            segments=14,
            mat=chrome_mat,
            parent=chassis,
            gltf_loc=(side * 0.34, 0.46, -1.04),
            gltf_quat=qax(1, 0, 0, -math.pi * 0.5),
        )
        make_sphere(f"Headlight_{tag}", 0.075, scale=(1, 1, 0.55), mat=headlight_mat, parent=chassis, gltf_loc=(side * 0.34, 0.46, -1.12), segments=12, rings=8)
        make_box(f"Taillight_{tag}", 0.22, 0.08, 0.06, mat=taillight_mat, parent=chassis, gltf_loc=(side * 0.32, 0.52, 1.12), bevel=0.02)

    # Double-wishbone A-arm suspension + coilover shocks connecting chassis to all 4 wheels
    for ax_tag, z_pos, r_w, x_w in (("Front", -0.84, spec["rf"], 0.80), ("Rear", 0.82, spec["rr"], 0.84)):
        for side in (-1, 1):
            make_tube(
                f"SuspLower_{ax_tag}_{side}",
                [(side * 0.32, 0.24, z_pos - 0.12), (side * x_w, r_w, z_pos), (side * 0.32, 0.24, z_pos + 0.12)],
                0.026,
                segments=8,
                mat=chrome_mat,
                parent=chassis,
            )
            make_tube(
                f"SuspCoil_{ax_tag}_{side}",
                [(side * 0.38, 0.48, z_pos), (side * (x_w - 0.14), r_w + 0.04, z_pos)],
                0.036,
                segments=8,
                mat=trim_mat,
                parent=chassis,
            )

    # Sculpted Racing Bucket Seat with side bolsters + DriverMount at exact [0, 0.54, 0.22]
    make_box("SeatCushion", 0.48, 0.11, 0.46, mat=leather_mat, parent=chassis, gltf_loc=(0, 0.49, 0.22), bevel=0.04)
    make_box("SeatBackrest", 0.46, 0.52, 0.11, mat=leather_mat, parent=chassis, gltf_loc=(0, 0.72, 0.44), gltf_quat=qax(1, 0, 0, -0.32), bevel=0.04)
    for side in (-1, 1):
        make_box(f"SeatBolster_{side}", 0.08, 0.42, 0.22, mat=primary_mat, parent=chassis, gltf_loc=(side * 0.24, 0.68, 0.34), gltf_quat=qax(1, 0, 0, -0.25), bevel=0.03)
    make_box("SeatHeadrest", 0.24, 0.16, 0.10, mat=trim_mat, parent=chassis, gltf_loc=(0, 0.98, 0.50), bevel=0.04)

    # EXACT DriverMount node required by RacerMeshInstance & GarageShowcaseStage
    make_empty("DriverMount", gltf_loc=(0.0, 0.54, 0.22), parent=chassis)

    # Dashboard pod + glowing speedometer dial + steering column + sport SteeringWheel
    make_box("DashPod", 0.42, 0.16, 0.24, mat=carbon_mat, parent=chassis, gltf_loc=(0, 0.64, -0.34), bevel=0.04)
    make_sphere("SpeedoDial", 0.075, scale=(1, 1, 0.3), mat=accent_glow_mat, parent=chassis, gltf_loc=(0, 0.68, -0.22), segments=12, rings=8)
    make_tube("SteeringColumn", [(0, 0.48, -0.38), (0, 0.72, -0.18)], 0.036, segments=10, mat=chrome_mat, parent=chassis)

    # EXACT SteeringWheel node (rotated around local Z in RacerMeshInstance)
    sw = make_empty("SteeringWheel", gltf_loc=(0.0, 0.73, -0.17), parent=chassis, gltf_quat=qax(1, 0, 0, -0.98))
    rim_pts = [(math.cos(i / 20 * math.tau) * 0.165, math.sin(i / 20 * math.tau) * 0.165, 0.0) for i in range(20)]
    make_tube("SteeringRim", rim_pts, 0.025, segments=8, closed=True, mat=leather_mat, parent=sw)
    make_box("SteeringSpokeH", 0.30, 0.042, 0.028, mat=chrome_mat, parent=sw, bevel=0.008)
    make_box("SteeringSpokeV", 0.045, 0.15, 0.028, mat=chrome_mat, parent=sw, gltf_loc=(0, -0.075, 0), bevel=0.008)
    make_sphere("SteeringCenterCap", 0.055, scale=(1, 1, 0.55), mat=trim_mat, parent=sw, segments=12, rings=8)

    # Detailed Rear Engine Block with twin cylinder banks + chrome intake manifold
    make_box("EngineBlock", 0.56, 0.30, 0.48, mat=carbon_mat, parent=chassis, gltf_loc=(0, 0.62, 0.78), bevel=0.05)
    for side in (-1, 1):
        make_box(f"CylinderHead_{side}", 0.22, 0.18, 0.38, mat=chrome_mat, parent=chassis, gltf_loc=(side * 0.22, 0.76, 0.78), gltf_quat=qax(0, 0, 1, -side * 0.38), bevel=0.03)
    make_lathe("TurboCharger", [(0.13, -0.08), (0.15, 0.0), (0.13, 0.08)], segments=14, mat=trim_mat, parent=chassis, gltf_loc=(0, 0.84, 0.84), gltf_quat=qax(0, 0, 1, math.pi * 0.5))

    # EXACT ExhaustL & ExhaustR nodes aligned with turbo flames at [±0.34, 0.72, 1.38]
    for side, ex_name in ((-1, "ExhaustL"), (1, "ExhaustR")):
        ex_node = make_empty(ex_name, gltf_loc=(side * 0.28, 0.58, 1.08), parent=chassis)
        if style == "armored-boiler":
            pts = [(0, 0, -0.10), (side * 0.08, 0.34, 0.04), (side * 0.08, 0.74, 0.10)]
            rads = [0.062, 0.072, 0.088]
            tip_q = qax(1, 0, 0, 0.0)
        else:
            pts = [(0, -0.04, -0.24), (side * 0.04, 0.04, -0.04), (side * 0.06, 0.14, 0.18)]
            rads = [0.058, 0.066, 0.082]
            tip_q = qax(1, 0, 0, math.pi * 0.5)
        make_tube(f"{ex_name}_Pipe", pts, rads, segments=12, mat=chrome_mat, parent=ex_node)
        lp = pts[-1]
        make_sphere(f"{ex_name}_Core", 0.060, scale=(1, 1, 0.45), mat=exhaust_core_mat, parent=ex_node, gltf_loc=lp, gltf_quat=tip_q, segments=10, rings=8)

    # 4 Independent Wheels touching Y = 0 (EXACT node names & positions)
    w_fl = add_wheel(kart_root, "WheelFL", spec["rf"], spec["wf"], tire_mat, chrome_mat, trim_mat, brake_mat, style)
    w_fl.location = (w_fl.location.x - 0.82, w_fl.location.y + 0.84, spec["rf"])
    w_fr = add_wheel(kart_root, "WheelFR", spec["rf"], spec["wf"], tire_mat, chrome_mat, trim_mat, brake_mat, style)
    w_fr.location = (0.82, 0.84, spec["rf"])
    w_rl = add_wheel(kart_root, "WheelRL", spec["rr"], spec["wr"], tire_mat, chrome_mat, trim_mat, brake_mat, style)
    w_rl.location = (-0.86, -0.82, spec["rr"])
    w_rr = add_wheel(kart_root, "WheelRR", spec["rr"], spec["wr"], tire_mat, chrome_mat, trim_mat, brake_mat, style)
    w_rr.location = (0.86, -0.82, spec["rr"])

    # Merge static mesh parts per articulated node to minimize WebGL draw calls (~8 draw calls per kart!)
    join_direct_mesh_children(chassis, f"{sid}_ChassisMesh")
    join_direct_mesh_children(sw, f"{sid}_SteeringWheelMesh")
    for w_obj in (w_fl, w_fr, w_rl, w_rr):
        join_direct_mesh_children(w_obj, f"{w_obj.name}_Mesh")
    for ex_name in ("ExhaustL", "ExhaustR"):
        ex_obj = bpy.data.objects.get(ex_name)
        if ex_obj:
            join_direct_mesh_children(ex_obj, f"{ex_name}_Mesh")

    out_path = os.path.join(PUBLIC_DIR, f"assets/karts/{spec['slug']}.glb")
    sz = export_glb(out_path)
    print(f"  [kart] {spec['slug']}.glb ({sz // 1024} KB)")


def main():
    print("=== Building All 8 Blender 4.5 Karts ===")
    for spec in KART_SPECS:
        build_kart(spec)
    print("=== Done All 8 Karts ===")


if __name__ == "__main__":
    main()
