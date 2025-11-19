import os
import sys
import numpy as np

CURRENT_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import create_object


def test_create_specific_sphere_shape_and_radius():
    center = np.array([0.0, 0.0, 5.0])
    size = 2.0
    resolution = 10
    x, y, z = create_object.create_specific(0, center, size, resolution)
    assert x is not None and y is not None and z is not None
    # Expect resolution*resolution points flattened
    assert x.shape[0] == resolution * resolution
    pts = np.stack([x, y, z], axis=-1)
    # Check points are roughly at distance ~size from center (within tolerance)
    dists = np.linalg.norm(pts - center, axis=1)
    assert np.allclose(dists.mean(), size, rtol=0.2, atol=0.2)


def test_create_specific_cube_edges_counts_and_bounds():
    center = np.array([1.0, -1.0, 5.0])
    size = 4.0  # cube side length
    resolution = 8
    x, y, z = create_object.create_specific(1, center, size, resolution)
    assert x is not None and y is not None and z is not None
    pts = np.stack([x, y, z], axis=-1)
    # Expect 12 edges * resolution samples
    assert pts.shape[0] == 12 * resolution
    # Bounds should be within [center - size/2, center + size/2] on each axis
    half = size / 2.0
    mins = center - half - 1e-6
    maxs = center + half + 1e-6
    assert np.all(pts >= mins) and np.all(pts <= maxs)


def test_create_specific_invalid_index():
    x, y, z = create_object.create_specific(99, np.zeros(3), 1.0, 5)
    assert x is None and y is None and z is None
