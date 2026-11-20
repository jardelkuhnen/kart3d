"""Blender 4.5 procedural generator for all 8 rigged, animated characters + Cycles portraits & HUD icons."""

import math
import os
import sys
import bpy
from mathutils import Vector

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
sys.path.insert(0, SCRIPT_DIR)

from blender_utils import (
    export_glb,
    g2b,
    gltf_axis_angle_to_blender_quat as qax,
    gltf_euler_yzx_to_blender_quat as geuler,
    join_direct_mesh_children,
    make_box,
    make_crystal_spire,
    make_empty,
    make_extruded_poly,
    make_lathe,
    make_pbr_mat,
    make_sphere,
    make_tube,
    render_studio_badge_png,
    reset_scene,
)

CHARACTER_SPECS = [
    {
        "id": "nilo",
        "style": "fox",
        "primary": (0.46, 0.21, 0.10),
        "secondary": (0.15, 0.19, 0.28),
        "accent": (0.06, 0.62, 0.56),
        "skin": (0.95, 0.44, 0.10),
        "iris": (0.14, 0.72, 0.36),
        "bg_top": (0.98, 0.56, 0.14),
        "bg_bot": (0.42, 0.16, 0.06),
        "rim": (0.99, 0.78, 0.18),
    },
    {
        "id": "boro",
        "style": "inventor",
        "primary": (0.15, 0.40, 0.92),
        "secondary": (0.58, 0.40, 0.14),
        "accent": (0.98, 0.80, 0.10),
        "skin": (0.94, 0.76, 0.62),
        "iris": (0.18, 0.48, 0.92),
        "bg_top": (0.24, 0.54, 0.98),
        "bg_bot": (0.08, 0.18, 0.46),
        "rim": (0.98, 0.82, 0.16),
    },
    {
        "id": "lumi",
        "style": "star-pilot",
        "primary": (0.44, 0.18, 0.88),
        "secondary": (0.10, 0.13, 0.26),
        "accent": (0.20, 0.82, 0.99),
        "skin": (0.92, 0.94, 1.0),
        "iris": (0.22, 0.84, 1.0),
        "bg_top": (0.54, 0.26, 0.96),
        "bg_bot": (0.14, 0.08, 0.36),
        "rim": (0.24, 0.84, 1.0),
    },
    {
        "id": "kora",
        "style": "forest",
        "primary": (0.06, 0.56, 0.38),
        "secondary": (0.42, 0.25, 0.12),
        "accent": (0.64, 0.92, 0.22),
        "skin": (0.88, 0.90, 0.78),
        "iris": (0.22, 0.78, 0.24),
        "bg_top": (0.10, 0.72, 0.46),
        "bg_bot": (0.04, 0.24, 0.16),
        "rim": (0.68, 0.94, 0.24),
    },
    {
        "id": "tiko",
        "style": "mechanic",
        "primary": (0.88, 0.16, 0.18),
        "secondary": (0.14, 0.16, 0.22),
        "accent": (0.96, 0.97, 0.99),
        "skin": (0.95, 0.74, 0.56),
        "iris": (0.52, 0.26, 0.12),
        "bg_top": (0.92, 0.24, 0.22),
        "bg_bot": (0.38, 0.07, 0.08),
        "rim": (0.96, 0.96, 0.98),
    },
    {
        "id": "mavi",
        "style": "navigator",
        "primary": (0.04, 0.60, 0.74),
        "secondary": (0.12, 0.16, 0.30),
        "accent": (0.98, 0.42, 0.52),
        "skin": (0.94, 0.76, 0.62),
        "iris": (0.06, 0.64, 0.78),
        "bg_top": (0.08, 0.72, 0.86),
        "bg_bot": (0.05, 0.20, 0.36),
        "rim": (0.98, 0.46, 0.56),
    },
    {
        "id": "runi",
        "style": "desert",
        "primary": (0.82, 0.44, 0.06),
        "secondary": (0.34, 0.20, 0.10),
        "accent": (0.99, 0.86, 0.24),
        "skin": (0.84, 0.62, 0.44),
        "iris": (0.88, 0.54, 0.08),
        "bg_top": (0.92, 0.54, 0.10),
        "bg_bot": (0.38, 0.18, 0.05),
        "rim": (0.99, 0.88, 0.26),
    },
    {
        "id": "zera",
        "style": "ice",
        "primary": (0.06, 0.56, 0.90),
        "secondary": (0.90, 0.96, 1.0),
        "accent": (0.36, 0.92, 1.0),
        "skin": (0.96, 0.86, 0.82),
        "iris": (0.18, 0.80, 0.98),
        "bg_top": (0.14, 0.72, 0.98),
        "bg_bot": (0.05, 0.22, 0.44),
        "rim": (0.48, 0.94, 1.0),
    },
]


def add_expressive_face(head, spec, mats, has_visor=False):
    """Add Pixar/Nintendo-style sculpted eyes with iris/pupil/catchlight, curved brows, and nose/smile."""
    if has_visor:
        # Sleek uninterrupted curved wrap-around holographic visor with subtle dark upper brow rim
        make_sphere(
            "TechVisorBacking",
            0.225,
            scale=(1.06, 0.50, 0.94),
            mat=mats["dark"],
            parent=head,
            gltf_loc=(0, 0.210, -0.055),
            segments=24,
            rings=14,
        )
        make_sphere(
            "TechVisor",
            0.228,
            scale=(1.03, 0.40, 0.96),
            mat=mats["glow"],
            parent=head,
            gltf_loc=(0, 0.208, -0.082),
            segments=24,
            rings=14,
        )
        # Chin breather vent
        make_box("HelmetChinVent", 0.12, 0.052, 0.06, mat=mats["secondary"], parent=head, gltf_loc=(0, 0.082, -0.215), bevel=0.015)
        return

    for side in (-1, 1):
        tag = "L" if side < 0 else "R"
        ex = side * 0.086
        ey = 0.205
        ez = -0.202
        # Glossy white sclera
        make_sphere(f"EyeSclera_{tag}", 0.044, scale=(0.95, 1.12, 0.65), mat=mats["white"], parent=head, gltf_loc=(ex, ey, ez), segments=14, rings=10)
        # Colored iris
        make_sphere(f"EyeIris_{tag}", 0.030, scale=(0.95, 1.10, 0.50), mat=mats["iris"], parent=head, gltf_loc=(ex, ey, ez - 0.018), segments=12, rings=8)
        # Deep dark pupil
        make_sphere(f"EyePupil_{tag}", 0.018, scale=(0.95, 1.08, 0.45), mat=mats["dark"], parent=head, gltf_loc=(ex, ey, ez - 0.025), segments=10, rings=8)
        # Bright specular catchlight dot
        make_sphere(f"EyeCatch_{tag}", 0.009, mat=mats["white"], parent=head, gltf_loc=(ex + side * 0.010, ey + 0.014, ez - 0.030), segments=8, rings=6)
        # Curved expressive eyebrow
        make_tube(
            f"Brow_{tag}",
            [(ex - side * 0.036, ey + 0.062, ez - 0.012), (ex, ey + 0.074, ez - 0.016), (ex + side * 0.038, ey + 0.064, ez - 0.008)],
            [0.012, 0.015, 0.011],
            segments=8,
            mat=mats["dark"],
            parent=head,
        )

    if spec["style"] == "fox":
        # Sculpted tapered fox muzzle + fluffy cheek tufts + shiny nose + cheerful grin
        make_lathe(
            "FoxSnout",
            [(0.115, 0.0), (0.095, 0.08), (0.055, 0.15), (0.015, 0.185)],
            segments=16,
            mat=mats["cream"],
            parent=head,
            gltf_loc=(0, 0.135, -0.165),
            gltf_quat=qax(1, 0, 0, -math.pi * 0.5),
            scale_xz=(1.15, 0.85),
        )
        make_sphere("FoxNose", 0.034, scale=(1.15, 0.85, 0.90), mat=mats["dark"], parent=head, gltf_loc=(0, 0.150, -0.345), segments=12, rings=8)
        for side in (-1, 1):
            make_crystal_spire(
                f"FoxCheekFluff_{side}",
                0.065,
                0.15,
                sides=6,
                mat=mats["cream"],
                parent=head,
                gltf_loc=(side * 0.18, 0.11, -0.08),
                gltf_quat=qax(0, 0, 1, -side * 1.15),
                bevel=0.015,
            )
    else:
        # Cute stylized nose + warm smile arc
        make_sphere("Nose", 0.025, scale=(1.0, 0.85, 0.95), mat=mats["skin"], parent=head, gltf_loc=(0, 0.155, -0.228), segments=10, rings=8)
        make_tube(
            "Smile",
            [(-0.048, 0.112, -0.214), (0.0, 0.098, -0.224), (0.048, 0.112, -0.214)],
            0.0085,
            segments=6,
            mat=mats["dark"],
            parent=head,
        )


def add_goggles(head, mats, brass_mat=None):
    """Detailed aviator/inventor/desert goggles perched on forehead."""
    rim_m = brass_mat or mats["secondary"]
    make_tube(
        "GoggleStrap",
        [(-0.225, 0.285, -0.10), (-0.24, 0.28, 0.04), (0.0, 0.275, 0.235), (0.24, 0.28, 0.04), (0.225, 0.285, -0.10)],
        0.024,
        segments=8,
        mat=mats["dark"],
        parent=head,
    )
    make_tube("GoggleBridge", [(-0.04, 0.312, -0.215), (0.04, 0.312, -0.215)], 0.018, segments=8, mat=rim_m, parent=head)
    for side in (-1, 1):
        make_lathe(
            f"GoggleRim_{side}",
            [(0.060, 0.0), (0.078, 0.01), (0.082, 0.048), (0.066, 0.055)],
            segments=18,
            mat=rim_m,
            parent=head,
            gltf_loc=(side * 0.095, 0.312, -0.205),
            gltf_quat=qax(1, 0, 0, 1.24),
        )
        make_sphere(
            f"GoggleLens_{side}",
            0.058,
            scale=(1.0, 1.0, 0.42),
            mat=mats["glow"],
            parent=head,
            gltf_loc=(side * 0.095, 0.326, -0.236),
            gltf_quat=qax(1, 0, 0, -0.32),
            segments=14,
            rings=10,
        )


def add_character_clips(nodes):
    """Bake all 9 mandatory GLTF animation clips cleanly via NLA tracks."""
    # Exact clip specifications preserving all 9 names expected by CharacterRig & tests
    clips = [
        (
            "idle",
            [0.0, 0.8, 1.6],
            {
                "Torso": {"rot": [(0.03, 0, 0), (-0.02, 0.03, 0), (0.03, 0, 0)]},
                "Head": {"rot": [(0.02, -0.07, 0), (-0.03, 0.09, 0.03), (0.02, -0.07, 0)]},
                "ArmL": {"rot": [(0, 0, 0), (-0.05, 0, 0.02), (0, 0, 0)]},
                "ArmR": {"rot": [(0, 0, 0), (-0.05, 0, -0.02), (0, 0, 0)]},
                "EarL": {"rot": [(0, 0, 0.18), (-0.08, 0, 0.26), (0, 0, 0.18)]},
                "EarR": {"rot": [(0, 0, -0.18), (-0.06, 0, -0.24), (0, 0, -0.18)]},
                "TailBase": {"rot": [(0, -0.20, 0), (0.06, 0.20, 0), (0, -0.20, 0)]},
                "ScarfTail": {"rot": [(0.05, -0.12, 0), (-0.05, 0.12, 0), (0.05, -0.12, 0)]},
            },
        ),
        (
            "drive",
            [0.0, 0.22, 0.44],
            {
                "Torso": {"rot": [(0.11, 0, 0), (0.14, 0, 0.025), (0.11, 0, 0)]},
                "Head": {"rot": [(-0.07, 0, 0), (-0.10, 0.025, 0), (-0.07, 0, 0)]},
                "ArmL": {"rot": [(-0.05, 0, 0), (-0.09, 0.03, 0), (-0.05, 0, 0)]},
                "ArmR": {"rot": [(-0.05, 0, 0), (-0.09, -0.03, 0), (-0.05, 0, 0)]},
                "EarL": {"rot": [(-0.26, 0, 0.18), (-0.34, 0, 0.22), (-0.26, 0, 0.18)]},
                "EarR": {"rot": [(-0.26, 0, -0.18), (-0.34, 0, -0.22), (-0.26, 0, -0.18)]},
                "TailBase": {"rot": [(-0.14, -0.16, 0), (-0.18, 0.16, 0), (-0.14, -0.16, 0)]},
                "ScarfTail": {"rot": [(-0.16, -0.24, 0.06), (-0.09, 0.24, -0.06), (-0.16, -0.24, 0.06)]},
            },
        ),
        (
            "turnLeft",
            [0.0, 0.25, 0.50],
            {
                "Torso": {"rot": [(0.12, 0.12, 0.22), (0.14, 0.15, 0.26), (0.12, 0.12, 0.22)]},
                "Head": {"rot": [(-0.04, 0.28, 0.10), (-0.06, 0.32, 0.12), (-0.04, 0.28, 0.10)]},
                "ArmL": {"rot": [(0.14, 0.10, 0), (0.16, 0.12, 0), (0.14, 0.10, 0)]},
                "ArmR": {"rot": [(-0.22, 0.12, 0), (-0.24, 0.14, 0), (-0.22, 0.12, 0)]},
                "EarL": {"rot": [(-0.25, 0.10, 0.32), (-0.30, 0.12, 0.36), (-0.25, 0.10, 0.32)]},
                "EarR": {"rot": [(-0.25, 0.10, -0.08), (-0.30, 0.12, -0.05), (-0.25, 0.10, -0.08)]},
                "TailBase": {"rot": [(-0.10, -0.35, -0.12), (-0.12, -0.28, -0.15), (-0.10, -0.35, -0.12)]},
                "ScarfTail": {"rot": [(-0.18, -0.32, -0.12), (-0.12, -0.40, -0.16), (-0.18, -0.32, -0.12)]},
            },
        ),
        (
            "turnRight",
            [0.0, 0.25, 0.50],
            {
                "Torso": {"rot": [(0.12, -0.12, -0.22), (0.14, -0.15, -0.26), (0.12, -0.12, -0.22)]},
                "Head": {"rot": [(-0.04, -0.28, -0.10), (-0.06, -0.32, -0.12), (-0.04, -0.28, -0.10)]},
                "ArmL": {"rot": [(-0.22, -0.12, 0), (-0.24, -0.14, 0), (-0.22, -0.12, 0)]},
                "ArmR": {"rot": [(0.14, -0.10, 0), (0.16, -0.12, 0), (0.14, -0.10, 0)]},
                "EarL": {"rot": [(-0.25, -0.10, 0.08), (-0.30, -0.12, 0.05), (-0.25, -0.10, 0.08)]},
                "EarR": {"rot": [(-0.25, -0.10, -0.32), (-0.30, -0.12, -0.36), (-0.25, -0.10, -0.32)]},
                "TailBase": {"rot": [(-0.10, 0.35, 0.12), (-0.12, 0.28, 0.15), (-0.10, 0.35, 0.12)]},
                "ScarfTail": {"rot": [(-0.18, 0.32, 0.12), (-0.12, 0.40, 0.16), (-0.18, 0.32, 0.12)]},
            },
        ),
        (
            "drift",
            [0.0, 0.18, 0.36],
            {
                "Torso": {"rot": [(0.24, 0, 0.28), (0.27, 0.04, 0.31), (0.24, 0, 0.28)]},
                "Head": {"rot": [(-0.12, -0.25, -0.08), (-0.15, -0.28, -0.10), (-0.12, -0.25, -0.08)]},
                "ArmL": {"rot": [(-0.18, -0.12, 0.14), (-0.24, -0.14, 0.18), (-0.18, -0.12, 0.14)]},
                "ArmR": {"rot": [(0.12, 0.10, -0.14), (0.16, 0.12, -0.18), (0.12, 0.10, -0.14)]},
                "EarL": {"rot": [(-0.42, 0, 0.34), (-0.50, 0, 0.38), (-0.42, 0, 0.34)]},
                "EarR": {"rot": [(-0.42, 0, -0.34), (-0.50, 0, -0.38), (-0.42, 0, -0.34)]},
                "TailBase": {"rot": [(-0.24, -0.32, 0), (-0.28, 0.32, 0), (-0.24, -0.32, 0)]},
                "ScarfTail": {"rot": [(-0.35, -0.38, 0.14), (-0.25, 0.38, -0.14), (-0.35, -0.38, 0.14)]},
            },
        ),
        (
            "hit",
            [0.0, 0.18, 0.40, 0.65],
            {
                "Torso": {"rot": [(-0.26, 0.22, -0.18), (-0.34, -0.24, 0.22), (-0.12, 0.12, -0.08), (0.05, 0, 0)]},
                "Head": {"rot": [(-0.22, -0.30, 0.15), (0.18, 0.35, -0.18), (-0.08, -0.12, 0.06), (0, 0, 0)]},
                "ArmL": {"rot": [(0.45, 0, 0.55), (0.60, 0.20, 0.72), (0.25, 0, 0.25), (0, 0, 0)]},
                "ArmR": {"rot": [(0.45, 0, -0.55), (0.60, -0.20, -0.72), (0.25, 0, -0.25), (0, 0, 0)]},
                "EarL": {"rot": [(0.25, 0, 0.45), (0.35, 0, 0.55), (0.10, 0, 0.28), (0, 0, 0.18)]},
                "EarR": {"rot": [(0.25, 0, -0.45), (0.35, 0, -0.55), (0.10, 0, -0.28), (0, 0, -0.18)]},
                "TailBase": {"rot": [(0.20, 0.40, 0), (0.20, -0.40, 0), (0.10, 0.20, 0), (0, 0, 0)]},
                "ScarfTail": {"rot": [(0.30, 0.30, 0), (0.20, -0.30, 0), (0.10, 0.15, 0), (0, 0, 0)]},
            },
        ),
        (
            "victory",
            [0.0, 0.35, 0.70, 1.05],
            {
                "Torso": {
                    "rot": [(-0.08, 0, 0), (-0.14, 0.12, 0.06), (-0.06, -0.12, -0.06), (-0.08, 0, 0)],
                    "pos": [(0, 0.18, 0), (0, 0.26, 0), (0, 0.20, 0), (0, 0.18, 0)],
                },
                "Head": {"rot": [(0.12, 0, 0), (0.20, 0.18, 0), (0.16, -0.18, 0), (0.12, 0, 0)]},
                "ArmL": {"rot": [(0.70, 0.20, 0.45), (1.15, 0.25, 0.65), (0.82, 0.15, 0.52), (0.70, 0.20, 0.45)]},
                "ArmR": {"rot": [(0.70, -0.20, -0.45), (1.15, -0.25, -0.65), (0.82, -0.15, -0.52), (0.70, -0.20, -0.45)]},
                "EarL": {"rot": [(0.10, 0, 0.15), (0.24, 0, 0.10), (0.14, 0, 0.20), (0.10, 0, 0.15)]},
                "EarR": {"rot": [(0.10, 0, -0.15), (0.24, 0, -0.10), (0.14, 0, -0.20), (0.10, 0, -0.15)]},
                "TailBase": {"rot": [(0.18, -0.42, 0), (0.24, 0.42, 0), (0.20, -0.35, 0), (0.18, -0.42, 0)]},
                "ScarfTail": {"rot": [(0.10, -0.25, 0), (0.20, 0.25, 0), (0.12, -0.20, 0), (0.10, -0.25, 0)]},
            },
        ),
        (
            "defeat",
            [0.0, 0.65, 1.30],
            {
                "Torso": {"rot": [(0.26, 0, 0), (0.32, 0.05, 0.04), (0.26, 0, 0)]},
                "Head": {"rot": [(-0.28, -0.14, 0.08), (-0.34, 0.14, -0.08), (-0.28, -0.14, 0.08)]},
                "ArmL": {"rot": [(-0.28, 0, 0.12), (-0.34, 0, 0.16), (-0.28, 0, 0.12)]},
                "ArmR": {"rot": [(-0.28, 0, -0.12), (-0.34, 0, -0.16), (-0.28, 0, -0.12)]},
                "EarL": {"rot": [(-0.35, 0, 0.55), (-0.40, 0, 0.60), (-0.35, 0, 0.55)]},
                "EarR": {"rot": [(-0.35, 0, -0.55), (-0.40, 0, -0.60), (-0.35, 0, -0.55)]},
                "TailBase": {"rot": [(-0.38, 0, 0), (-0.44, 0.06, 0), (-0.38, 0, 0)]},
                "ScarfTail": {"rot": [(-0.20, 0, 0), (-0.24, 0.04, 0), (-0.20, 0, 0)]},
            },
        ),
        (
            "podium",
            [0.0, 0.45, 0.90, 1.35],
            {
                "Torso": {
                    "rot": [(0, -0.08, 0), (-0.08, 0.18, 0.06), (-0.04, 0.02, -0.05), (0, -0.08, 0)],
                    "pos": [(0, 0.18, 0), (0, 0.28, 0), (0, 0.21, 0), (0, 0.18, 0)],
                },
                "Head": {"rot": [(0.14, -0.10, 0), (0.22, 0.15, 0.05), (0.18, 0.05, -0.04), (0.14, -0.10, 0)]},
                "ArmL": {"rot": [(0.95, 0.15, 0.55), (1.25, 0.25, 0.72), (0.92, 0.12, 0.50), (0.95, 0.15, 0.55)]},
                "ArmR": {"rot": [(0.32, 0, -0.25), (0.75, -0.15, -0.50), (0.45, -0.05, -0.35), (0.32, 0, -0.25)]},
                "EarL": {"rot": [(0.15, 0, 0.15), (0.28, 0, 0.12), (0.20, 0, 0.18), (0.15, 0, 0.15)]},
                "EarR": {"rot": [(0.15, 0, -0.15), (0.28, 0, -0.12), (0.20, 0, -0.18), (0.15, 0, -0.15)]},
                "TailBase": {"rot": [(0.20, -0.35, 0), (0.28, 0.35, 0), (0.22, -0.28, 0), (0.20, -0.35, 0)]},
                "ScarfTail": {"rot": [(0.08, -0.22, 0), (0.16, 0.22, 0), (0.10, -0.18, 0), (0.08, -0.22, 0)]},
            },
        ),
    ]

    fps = 30.0
    for clip_name, times, node_tracks in clips:
        for node_name, track_data in node_tracks.items():
            obj = nodes[node_name]
            obj.rotation_mode = 'QUATERNION'
            if obj.animation_data is None:
                obj.animation_data_create()

            act = bpy.data.actions.new(name=f"{clip_name}_{node_name}")
            obj.animation_data.action = act

            for idx, t in enumerate(times):
                frame = int(round(t * fps)) + 1
                if "rot" in track_data:
                    rx, ry, rz = track_data["rot"][idx]
                    obj.rotation_quaternion = geuler(rx, ry, rz)
                    obj.keyframe_insert(data_path="rotation_quaternion", frame=frame)
                if "pos" in track_data:
                    px, py, pz = track_data["pos"][idx]
                    obj.location = g2b(px, py, pz)
                    obj.keyframe_insert(data_path="location", frame=frame)

            nla_track = obj.animation_data.nla_tracks.new()
            nla_track.name = clip_name
            strip = nla_track.strips.new(clip_name, 1, act)
            strip.name = clip_name
            obj.animation_data.action = None

    # Restore rest transforms cleanly
    nodes["Torso"].location = g2b(0, 0.18, 0)
    for n in nodes.values():
        n.rotation_quaternion = geuler(0, 0, 0)
    nodes["EarL"].rotation_quaternion = qax(0, 0, 1, 0.36)
    nodes["EarR"].rotation_quaternion = qax(0, 0, 1, -0.36)


def build_character(spec):
    reset_scene()
    cid = spec["id"]
    style = spec["style"]

    mats = {
        "skin": make_pbr_mat(f"{cid}_Skin", color=spec["skin"], roughness=0.58, metallic=0.02),
        "jacket": make_pbr_mat(f"{cid}_Jacket", color=spec["primary"], roughness=0.42, metallic=0.14, coat=0.25),
        "secondary": make_pbr_mat(f"{cid}_Secondary", color=spec["secondary"], roughness=0.45, metallic=0.24),
        "accent": make_pbr_mat(f"{cid}_Accent", color=spec["accent"], roughness=0.30, metallic=0.30, coat=0.35),
        "cream": make_pbr_mat(f"{cid}_Cream", color=(0.98, 0.94, 0.86), roughness=0.62),
        "white": make_pbr_mat(f"{cid}_White", color=(0.98, 0.99, 1.0), roughness=0.12, coat=0.8),
        "dark": make_pbr_mat(f"{cid}_Dark", color=(0.07, 0.08, 0.11), roughness=0.22, metallic=0.20, coat=0.4),
        "iris": make_pbr_mat(f"{cid}_Iris", color=spec["iris"], roughness=0.14, coat=0.9),
        "gold": make_pbr_mat(f"{cid}_Gold", color=(0.98, 0.78, 0.16), metallic=0.86, roughness=0.20, coat=0.4),
        "chrome": make_pbr_mat(f"{cid}_Chrome", color=(0.86, 0.90, 0.95), metallic=0.92, roughness=0.16),
        "glow": make_pbr_mat(f"{cid}_Glow", color=spec["accent"], emissive=spec["accent"], emissive_strength=1.15, roughness=0.14, metallic=0.32, coat=0.9),
    }

    # Exact required node hierarchy
    root = make_empty(f"Character_{cid}_Root")
    pelvis = make_empty("Pelvis", parent=root)

    # Sculpted seated pelvis, utility belt & legs/racing boots
    make_lathe("HipMesh", [(0.17, 0.0), (0.23, 0.09), (0.20, 0.19)], segments=18, mat=mats["secondary"], parent=pelvis)
    make_lathe("BeltRing", [(0.215, 0.16), (0.225, 0.21)], segments=18, mat=mats["dark"], parent=pelvis, cap_top=False, cap_bottom=False)
    make_box("BeltBuckle", 0.09, 0.065, 0.04, mat=mats["gold"], parent=pelvis, gltf_loc=(0, 0.185, -0.21), bevel=0.012)

    for side, tag in ((-1, "L"), (1, "R")):
        make_tube(
            f"Leg_{tag}",
            [(side * 0.12, 0.08, 0.0), (side * 0.15, 0.07, -0.24), (side * 0.14, -0.01, -0.43)],
            [0.078, 0.066, 0.056],
            segments=12,
            mat=mats["secondary"],
            parent=pelvis,
        )
        make_box(f"Boot_{tag}", 0.115, 0.095, 0.18, mat=mats["dark"], parent=pelvis, gltf_loc=(side * 0.14, -0.025, -0.47), bevel=0.032)
        make_box(f"BootSole_{tag}", 0.122, 0.028, 0.19, mat=mats["accent"], parent=pelvis, gltf_loc=(side * 0.14, -0.065, -0.47), bevel=0.008)

    # Torso (animated)
    torso = make_empty("Torso", gltf_loc=(0.0, 0.18, 0.0), parent=pelvis)
    make_lathe(
        "TorsoMesh",
        [(0.17, 0.0), (0.24, 0.13), (0.26, 0.27), (0.20, 0.37), (0.11, 0.43)],
        segments=20,
        mat=mats["jacket"],
        parent=torso,
        scale_xz=(1.06, 0.90),
    )
    # Sculpted chest bib, zipper / racing emblem, and plush/rolled collar
    make_box("ChestBib", 0.22, 0.26, 0.12, mat=mats["cream"] if style == "fox" else mats["accent"], parent=torso, gltf_loc=(0, 0.21, -0.165), bevel=0.045)
    make_sphere("ChestEmblem", 0.055, scale=(1, 1, 0.4), mat=mats["gold"] if style != "star-pilot" else mats["glow"], parent=torso, gltf_loc=(0, 0.27, -0.225), segments=12, rings=8)
    make_lathe(
        "JacketCollar",
        [(0.16, 0.35), (0.225, 0.39), (0.195, 0.455), (0.13, 0.44)],
        segments=18,
        mat=mats["cream"] if style == "ice" else mats["accent"],
        parent=torso,
    )

    # Signature torso / shoulder equipment
    if style in ("star-pilot", "forest", "ice"):
        for side, tag in ((-1, "L"), (1, "R")):
            make_sphere(
                f"Pauldron_{tag}",
                0.11,
                scale=(1.1, 0.72, 1.15),
                mat=mats["glow"] if style == "star-pilot" else (mats["cream"] if style == "ice" else mats["accent"]),
                parent=torso,
                gltf_loc=(side * 0.25, 0.34, -0.01),
                gltf_quat=qax(0, 0, 1, -side * 0.30),
                segments=14,
                rings=10,
            )
    elif style == "mechanic":
        # Sculpted chrome box-end mechanic wrench strapped across back
        wr = make_empty("BackWrench", gltf_loc=(0.04, 0.28, 0.24), parent=torso, gltf_quat=qax(0, 0, 1, 0.48))
        make_box("WrenchShaft", 0.065, 0.56, 0.042, mat=mats["chrome"], parent=wr, bevel=0.014)
        for wy in (-0.28, 0.28):
            make_box(f"WrenchJaw_{wy:+.1f}", 0.16, 0.13, 0.048, mat=mats["chrome"], parent=wr, gltf_loc=(0, wy, 0), bevel=0.02)
            make_box(f"WrenchSlot_{wy:+.1f}", 0.07, 0.08, 0.056, mat=mats["dark"], parent=wr, gltf_loc=(0, wy + (0.04 if wy > 0 else -0.04), 0), bevel=0.01)
    elif style == "navigator":
        # Gold captain epaulets + brass buttons
        for side in (-1, 1):
            make_box(f"Epaulet_{side}", 0.13, 0.045, 0.11, mat=mats["gold"], parent=torso, gltf_loc=(side * 0.23, 0.38, -0.01), bevel=0.015)
        for by in (0.16, 0.24, 0.32):
            for bx in (-0.075, 0.075):
                make_sphere(f"CoatBtn_{bx:+.2f}_{by:.2f}", 0.018, mat=mats["gold"], parent=torso, gltf_loc=(bx, by, -0.22), segments=8, rings=6)

    # ScarfTail node (animated flowing scarf / cape)
    scarf_tail = make_empty("ScarfTail", gltf_loc=(0.08, 0.38, 0.14), parent=torso)
    if style in ("star-pilot", "forest"):
        make_box("HeroCape", 0.42, 0.045, 0.48, mat=mats["accent"], parent=scarf_tail, gltf_loc=(-0.08, -0.09, 0.20), gltf_quat=qax(1, 0, 0, -0.28), bevel=0.02)
        make_box("HeroCapeTrim", 0.44, 0.032, 0.08, mat=mats["gold"] if style == "forest" else mats["glow"], parent=scarf_tail, gltf_loc=(-0.08, -0.15, 0.42), bevel=0.01)
    elif style in ("fox", "navigator", "desert"):
        make_tube(
            "ScarfRibbonA",
            [(0.0, 0.0, 0.0), (0.07, -0.03, 0.18), (0.12, -0.07, 0.38)],
            [0.052, 0.058, 0.038],
            segments=10,
            mat=mats["accent"],
            parent=scarf_tail,
        )
        make_tube(
            "ScarfRibbonB",
            [(-0.06, -0.02, 0.02), (-0.02, -0.07, 0.16), (0.02, -0.12, 0.30)],
            [0.042, 0.046, 0.028],
            segments=8,
            mat=mats["gold"] if style == "desert" else mats["accent"],
            parent=scarf_tail,
        )

    # TailBase node (bushy fox tail / twin brass inventor tanks / glowing cryo canisters)
    tail_base = make_empty("TailBase", gltf_loc=(0.0, 0.06, 0.18), parent=pelvis)
    if style == "fox":
        make_tube(
            "TailBody",
            [(0, 0, 0), (0, 0.14, 0.22), (0, 0.34, 0.38)],
            [0.065, 0.125, 0.115],
            segments=14,
            mat=mats["skin"],
            parent=tail_base,
        )
        make_lathe(
            "TailTip",
            [(0.115, 0.0), (0.125, 0.08), (0.075, 0.17), (0.01, 0.24)],
            segments=14,
            mat=mats["cream"],
            parent=tail_base,
            gltf_loc=(0, 0.34, 0.38),
            gltf_quat=qax(1, 0, 0, 1.35),
        )
    elif style in ("inventor", "ice"):
        for side, tag in ((-1, "L"), (1, "R")):
            tank_mat = mats["glow"] if style == "ice" else mats["gold"]
            make_lathe(
                f"BackPackTank_{tag}",
                [(0.02, 0.0), (0.082, 0.03), (0.086, 0.27), (0.055, 0.33), (0.015, 0.36)],
                segments=14,
                mat=tank_mat,
                parent=tail_base,
                gltf_loc=(side * 0.105, 0.12, 0.07),
            )
            make_lathe(
                f"TankBand_{tag}",
                [(0.092, 0.10), (0.092, 0.16)],
                segments=14,
                mat=mats["dark"],
                parent=tail_base,
                gltf_loc=(side * 0.105, 0.12, 0.07),
                cap_top=False,
                cap_bottom=False,
            )

    # Head assembly (EXACT name 'Head' at [0, 0.44, -0.02])
    head = make_empty("Head", gltf_loc=(0.0, 0.44, -0.02), parent=torso)
    # Neck cylinder
    make_lathe("Neck", [(0.085, -0.05), (0.08, 0.06)], segments=12, mat=mats["skin"], parent=head)
    # Smooth sculpted stylized head cranium (10 profile stops + subsurf for Pixar-smooth silhouette)
    make_lathe(
        "HeadCranium",
        [
            (0.08, 0.0),
            (0.145, 0.035),
            (0.198, 0.085),
            (0.228, 0.145),
            (0.238, 0.205),
            (0.232, 0.265),
            (0.210, 0.318),
            (0.165, 0.360),
            (0.095, 0.386),
            (0.01, 0.398),
        ],
        segments=28,
        mat=mats["jacket"] if style == "star-pilot" else mats["skin"],
        parent=head,
        scale_xz=(1.03, 0.98),
    )

    add_expressive_face(head, spec, mats, has_visor=(style in ("star-pilot", "ice")))

    # Bespoke Headgear & Hair per Character
    if style == "fox":
        add_goggles(head, mats, mats["gold"])
        # Cute forehead fur tuft
        make_crystal_spire("ForeheadTuft", 0.045, 0.11, sides=5, mat=mats["skin"], parent=head, gltf_loc=(0, 0.35, -0.14), gltf_quat=qax(1, 0, 0, -0.55), bevel=0.01)

    elif style == "inventor":
        add_goggles(head, mats, mats["gold"])
        # Domed brass-trimmed steampunk helmet + top spin gear fin
        make_lathe(
            "InventorDome",
            [(0.246, 0.23), (0.252, 0.31), (0.20, 0.41), (0.08, 0.475), (0.01, 0.49)],
            segments=20,
            mat=mats["secondary"],
            parent=head,
        )
        make_box("HelmetRidge", 0.05, 0.10, 0.36, mat=mats["gold"], parent=head, gltf_loc=(0, 0.46, 0.02), bevel=0.015)

    elif style == "star-pilot":
        # Sleek space helmet halo crest & side ear pods
        make_lathe(
            "StarHelmetShell",
            [(0.246, 0.21), (0.262, 0.30), (0.21, 0.41), (0.10, 0.465), (0.01, 0.48)],
            segments=22,
            mat=mats["secondary"],
            parent=head,
        )
        make_tube("StarHelmetArc", [(0, 0.46, -0.14), (0, 0.50, 0.02), (0, 0.42, 0.22)], [0.024, 0.032, 0.022], segments=8, mat=mats["glow"], parent=head)

    elif style == "forest":
        # Flowing leaf-crown hair & braided wooden circlet with glowing forest gem
        make_lathe(
            "ForestHairCap",
            [(0.245, 0.22), (0.255, 0.31), (0.18, 0.40), (0.01, 0.43)],
            segments=18,
            mat=mats["jacket"],
            parent=head,
        )
        make_lathe(
            "ForestCirclet",
            [(0.248, 0.26), (0.260, 0.305), (0.248, 0.33)],
            segments=18,
            mat=mats["secondary"],
            parent=head,
            cap_top=False,
            cap_bottom=False,
        )
        make_crystal_spire("ForestCrownGem", 0.042, 0.11, sides=6, mat=mats["glow"], parent=head, gltf_loc=(0, 0.295, -0.252), double_ended=True, bevel=0.008)

    elif style == "mechanic":
        # Backwards racing pit cap with stitched brim + sculpted hair bangs peeking forward
        make_lathe(
            "PitCapCrown",
            [(0.245, 0.24), (0.248, 0.34), (0.16, 0.42), (0.01, 0.445)],
            segments=20,
            mat=mats["jacket"],
            parent=head,
        )
        make_box("PitCapBrim", 0.30, 0.042, 0.22, mat=mats["accent"], parent=head, gltf_loc=(0, 0.265, 0.24), gltf_quat=qax(1, 0, 0, -0.10), bevel=0.015)
        make_sphere("CapButton", 0.028, mat=mats["accent"], parent=head, gltf_loc=(0, 0.445, 0), segments=10, rings=8)
        # Stylish swept hair tufts tucked neatly above eyebrows
        for bx, ang in ((-0.09, 0.38), (0.0, 0.15), (0.09, -0.32)):
            make_crystal_spire(
                f"HairBang_{bx:+.2f}",
                0.030,
                0.075,
                sides=6,
                mat=mats["dark"],
                parent=head,
                gltf_loc=(bx, 0.285, -0.215),
                gltf_quat=qax(0, 0, 1, ang) @ qax(1, 0, 0, -1.95),
                bevel=0.008,
            )

    elif style == "navigator":
        # Iconic navy-and-gold captain tricorn hat with sweeping coral plume & hair bob
        make_lathe("HairBob", [(0.245, 0.16), (0.255, 0.26), (0.22, 0.35)], segments=16, mat=mats["dark"], parent=head, gltf_loc=(0, 0, 0.04))
        brim_poly = [(-0.36, 0.0), (0.36, 0.0), (0.26, 0.11), (-0.26, 0.11)]
        make_extruded_poly("TricornBrim", brim_poly, 0.46, mat=mats["secondary"], parent=head, gltf_loc=(0, 0.295, 0.0), bevel=0.03)
        make_box("TricornGoldBand", 0.44, 0.04, 0.46, mat=mats["gold"], parent=head, gltf_loc=(0, 0.315, 0.0), bevel=0.015)
        make_lathe("TricornCrown", [(0.22, 0.31), (0.19, 0.46), (0.02, 0.48)], segments=16, mat=mats["jacket"], parent=head)
        make_tube("CaptainPlume", [(0.14, 0.42, -0.02), (0.22, 0.56, 0.08), (0.20, 0.58, 0.28)], [0.035, 0.068, 0.028], segments=10, mat=mats["accent"], parent=head)

    elif style == "desert":
        add_goggles(head, mats, mats["gold"])
        # Layered cream desert turban + glowing golden sun medallion
        make_lathe(
            "DesertTurban",
            [(0.245, 0.22), (0.295, 0.31), (0.285, 0.39), (0.18, 0.46), (0.02, 0.48)],
            segments=20,
            mat=mats["cream"],
            parent=head,
        )
        make_lathe(
            "TurbanBand",
            [(0.298, 0.29), (0.304, 0.35)],
            segments=20,
            mat=mats["gold"],
            parent=head,
            cap_top=False,
            cap_bottom=False,
        )
        make_crystal_spire("SunGem", 0.055, 0.13, sides=6, mat=mats["glow"], parent=head, gltf_loc=(0, 0.355, -0.275), double_ended=True, bevel=0.01)

    elif style == "ice":
        # Insulated glacial parka hood shifted slightly back so sleek cyan ski-visor shines unobstructed
        make_lathe(
            "PolarHood",
            [(0.245, 0.14), (0.275, 0.26), (0.258, 0.39), (0.15, 0.465), (0.02, 0.48)],
            segments=22,
            mat=mats["jacket"],
            parent=head,
            gltf_loc=(0, 0, 0.045),
        )
        # Plush sculpted white fur trim halo framing visor cleanly
        fur_pts = [(math.cos(a) * 0.255, 0.225 + math.sin(a) * 0.205, -0.115) for a in [i / 18 * math.tau for i in range(18)]]
        make_tube("HoodFurTrim", fur_pts, 0.056, segments=10, closed=True, mat=mats["cream"], parent=head)

    # EarL & EarR nodes (animated ears / antennae / antlers / earcups / fur flaps)
    ear_l = make_empty("EarL", gltf_loc=(-0.14, 0.31, 0.01), parent=head, gltf_quat=qax(0, 0, 1, 0.36))
    ear_r = make_empty("EarR", gltf_loc=(0.14, 0.31, 0.01), parent=head, gltf_quat=qax(0, 0, 1, -0.36))

    if style == "fox":
        ear_poly = [(-0.082, 0.0), (0.082, 0.0), (0.024, 0.22), (-0.024, 0.22)]
        inner_poly = [(-0.048, 0.02), (0.048, 0.02), (0.012, 0.15), (-0.012, 0.15)]
        tip_poly = [(-0.045, 0.145), (0.045, 0.145), (0.008, 0.245), (-0.008, 0.245)]
        for enode, tag in ((ear_l, "L"), (ear_r, "R")):
            make_extruded_poly(f"Ear{tag}Mesh", ear_poly, 0.055, mat=mats["skin"], parent=enode, bevel=0.016)
            make_extruded_poly(f"Ear{tag}Inner", inner_poly, 0.028, mat=mats["cream"], parent=enode, gltf_loc=(0, 0, -0.024), bevel=0.008)
            make_extruded_poly(f"Ear{tag}Tip", tip_poly, 0.060, mat=mats["dark"], parent=enode, bevel=0.012)
    elif style == "star-pilot":
        for enode, tag, sgn in ((ear_l, "L", -1), (ear_r, "R", 1)):
            make_tube(f"Antler{tag}", [(0, 0, 0), (sgn * 0.03, 0.16, 0.02), (sgn * 0.05, 0.25, 0.04)], [0.028, 0.022, 0.018], segments=10, mat=mats["chrome"], parent=enode)
            make_sphere(f"AntlerOrb{tag}", 0.054, mat=mats["glow"], parent=enode, gltf_loc=(sgn * 0.05, 0.27, 0.04), segments=12, rings=8)
    elif style == "forest":
        for enode, tag, sgn in ((ear_l, "L", -1), (ear_r, "R", 1)):
            make_tube(f"AntlerMain{tag}", [(0, 0, 0), (sgn * 0.04, 0.14, 0.02), (sgn * 0.09, 0.26, 0.04)], [0.028, 0.022, 0.014], segments=10, mat=mats["secondary"], parent=enode)
            make_tube(f"AntlerBranch{tag}", [(sgn * 0.04, 0.14, 0.02), (sgn * 0.12, 0.20, -0.02)], [0.018, 0.012], segments=8, mat=mats["secondary"], parent=enode)
            make_crystal_spire(f"AntlerBud{tag}", 0.035, 0.09, sides=6, mat=mats["glow"], parent=enode, gltf_loc=(sgn * 0.09, 0.27, 0.04), double_ended=True, bevel=0.006)
    elif style in ("inventor", "mechanic"):
        for enode, tag, sgn in ((ear_l, "L", -1), (ear_r, "R", 1)):
            make_lathe(
                f"EarCup{tag}",
                [(0.01, -0.045), (0.092, -0.04), (0.098, 0.03), (0.072, 0.05), (0.01, 0.052)],
                segments=16,
                mat=mats["accent"],
                parent=enode,
                gltf_loc=(sgn * 0.09, -0.10, 0.0),
                gltf_quat=qax(0, 0, 1, sgn * math.pi * 0.5),
            )
    else:
        for enode, tag, sgn in ((ear_l, "L", -1), (ear_r, "R", 1)):
            make_box(f"EarOrn{tag}", 0.085, 0.19, 0.12, mat=mats["accent"], parent=enode, gltf_loc=(sgn * 0.085, -0.07, 0), bevel=0.032)
            if style == "ice":
                make_sphere(f"EarPom{tag}", 0.052, mat=mats["cream"], parent=enode, gltf_loc=(sgn * 0.09, -0.18, 0), segments=10, rings=8)

    # Articulated Arms reaching forward to steering wheel + cuffed sleeves + racing gloves
    arm_l = make_empty("ArmL", gltf_loc=(-0.22, 0.31, -0.02), parent=torso)
    arm_r = make_empty("ArmR", gltf_loc=(0.22, 0.31, -0.02), parent=torso)

    for anode, tag, sgn in ((arm_l, "L", -1), (arm_r, "R", 1)):
        make_sphere(f"ShoulderJoint_{tag}", 0.072, mat=mats["jacket"], parent=anode, segments=12, rings=8)
        make_tube(
            f"Arm{tag}Mesh",
            [(0.0, 0.0, 0.0), (-sgn * 0.02, -0.10, -0.16), (-sgn * 0.04, -0.08, -0.31)],
            [0.060, 0.054, 0.048],
            segments=12,
            mat=mats["jacket"],
            parent=anode,
        )
        make_lathe(
            f"Cuff_{tag}",
            [(0.056, 0.0), (0.062, 0.05)],
            segments=12,
            mat=mats["accent"],
            parent=anode,
            gltf_loc=(-sgn * 0.035, -0.082, -0.28),
            gltf_quat=qax(1, 0, 0, math.pi * 0.5),
        )
        make_sphere(f"Glove_{tag}", 0.062, scale=(0.95, 0.88, 1.15), mat=mats["dark"], parent=anode, gltf_loc=(-sgn * 0.042, -0.082, -0.35), segments=12, rings=8)

    # 1. Render Cycles Studio Portrait (256x256) & HUD Icon (128x128) directly from the 3D character head!
    # Slight cheerful 3/4 turn of the head for maximum personality in portrait
    head.rotation_quaternion = geuler(0.06, -0.22, 0.0)
    p_path = os.path.join(PUBLIC_DIR, f"assets/ui/portrait_{cid}.png")
    i_path = os.path.join(PUBLIC_DIR, f"assets/ui/icon_{cid}.png")

    p_sz = render_studio_badge_png(
        p_path,
        cam_gltf_pos=(0.24, 0.89, -1.48),
        look_at_gltf=(0.0, 0.85, -0.04),
        lens_mm=52,
        size=256,
        bg_top_rgb=spec["bg_top"],
        bg_bot_rgb=spec["bg_bot"],
        rim_rgb=spec["rim"],
        rim_width=0.052,
        samples=28,
        rim_light_color=spec["rim"],
    )
    i_sz = render_studio_badge_png(
        i_path,
        cam_gltf_pos=(0.20, 0.89, -1.36),
        look_at_gltf=(0.0, 0.85, -0.04),
        lens_mm=54,
        size=128,
        bg_top_rgb=spec["bg_top"],
        bg_bot_rgb=spec["bg_bot"],
        rim_rgb=spec["rim"],
        rim_width=0.062,
        samples=22,
        rim_light_color=spec["rim"],
    )

    # 2. Merge static meshes per articulated joint node (cuts draw calls from ~38 to ~9 per character!)
    for joint_obj in (pelvis, torso, head, arm_l, arm_r, ear_l, ear_r, tail_base, scarf_tail):
        join_direct_mesh_children(joint_obj, f"{cid}_{joint_obj.name}_Mesh")
    # Also flatten BackWrench child empty if present under torso
    bw = bpy.data.objects.get("BackWrench")
    if bw:
        join_direct_mesh_children(bw, f"{cid}_BackWrench_Mesh")

    # 3. Bake all 9 GLTF animation clips & export character GLB
    nodes = {
        "Torso": torso,
        "Head": head,
        "ArmL": arm_l,
        "ArmR": arm_r,
        "EarL": ear_l,
        "EarR": ear_r,
        "TailBase": tail_base,
        "ScarfTail": scarf_tail,
    }
    add_character_clips(nodes)

    out_path = os.path.join(PUBLIC_DIR, f"assets/characters/{cid}.glb")
    glb_sz = export_glb(out_path, animated=True)
    print(f"  [char] {cid}.glb ({glb_sz // 1024} KB) | portrait ({p_sz // 1024} KB) | icon ({i_sz // 1024} KB)")


def main():
    print("=== Building All 8 Blender 4.5 Characters + Cycles Portraits & Icons ===")
    for spec in CHARACTER_SPECS:
        build_character(spec)
    print("=== Done All 8 Characters ===")


if __name__ == "__main__":
    main()
