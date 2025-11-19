import os
import sys
import math
import numpy as np

# Ensure the project root (where projection.py lives) is importable
CURRENT_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import projection


def test_project_3d_to_2d_basic():
    # Points at z=2 with focal_length=2 and center at (0,0)
    pts3d = np.array([
        [2.0, 0.0, 2.0],   # projects to (2,0)
        [0.0, 2.0, 2.0],   # projects to (0,2)
        [-2.0, -2.0, 2.0], # projects to (-2,-2)
    ])
    out = projection.project_3d_to_2d(pts3d, focal_length=2, center_x=0, center_y=0)
    assert out.shape == (3, 2)
    assert tuple(out[0]) == (2, 0)
    assert tuple(out[1]) == (0, 2)
    assert tuple(out[2]) == (-2, -2)


def test_project_3d_to_2d_filters_negative_or_zero_z():
    pts3d = np.array([
        [1.0, 1.0, -1.0],  # behind camera -> filtered
        [1.0, 1.0, 0.0],   # z<=0 -> filtered
        [1.0, 1.0, 1.0],   # valid
    ])
    out = projection.project_3d_to_2d(pts3d)
    assert out.shape[0] == 1


def test_rotate_points_identity():
    pts = np.array([
        [1.0, 2.0, 3.0],
        [-1.0, 0.0, 5.0],
    ])
    # Use centroid as desired center so identity rotation preserves points
    center = pts.mean(axis=0)
    rotated = projection.rotate_points(pts, [0, 0, 0], center)
    assert np.allclose(rotated, pts)


def test_rotate_points_z_90deg_about_origin():
    pts = np.array([[1.0, 0.0, 0.0]])
    center = np.array([0.0, 0.0, 0.0])
    rotated = projection.rotate_points(pts, [0, 0, 90], center, actual_center=center)
    # (1,0,0) rotated +90deg around Z becomes (0,1,0)
    assert np.allclose(rotated, np.array([[0.0, 1.0, 0.0]]), atol=1e-6)


def test_rotate_points_preserves_desired_center_as_centroid():
    # Points with centroid not at desired center
    pts = np.array([
        [2.0, 2.0, 2.0],
        [3.0, 2.0, 2.0],
        [2.0, 3.0, 2.0],
        [3.0, 3.0, 2.0],
    ])
    desired_center = np.array([10.0, 0.0, 5.0])
    rotated = projection.rotate_points(pts, [30, 45, 60], desired_center)
    # Centroid of rotated points should be (approximately) the desired center
    centroid = rotated.mean(axis=0)
    assert np.allclose(centroid, desired_center, atol=1e-6)
