import os
import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from mediapipe.framework.formats import landmark_pb2
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
import numpy as np
import matplotlib.cm as cm
import create_object
import projection


def draw_help_overlay(frame, rotation_active, rotation_speed, active_axis, last_gesture):
    """Draw a compact, semi-transparent help overlay with key gestures and current state."""
    try:
        overlay = frame.copy()
        h, w = frame.shape[:2]
        box_w = min(420, int(w * 0.6))
        box_h = 200
        x0, y0 = 10, 10
        x1, y1 = x0 + box_w, y0 + box_h

        # Background rectangle (filled) on overlay
        cv2.rectangle(overlay, (x0, y0), (x1, y1), (0, 0, 0), thickness=-1)
        # Blend overlay
        alpha = 0.35
        cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)

        # Text lines
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.45
        color = (255, 255, 255)
        line_h = 18
        pad = 8
        y = y0 + pad + 5

        lines = [
            "Gesture Help (ESC to exit)",
            "Open_Palm: Reset | Closed_Fist: Toggle rotation",
            "Victory: Switch object | Pointing_Up: Cycle X/Y/Z",
            "Thumb_Up: Speed+ | Thumb_Down: Speed-",
            "Right hand: Move | Pinch (left): Scale",
        ]

        state = f"State: rot={'ON' if rotation_active else 'OFF'} | speed={rotation_speed:.1f} | axis={'XYZ'[active_axis]} | last={last_gesture or '-'}"
        lines.append(state)

        for line in lines:
            cv2.putText(frame, line, (x0 + pad, y), font, font_scale, color, 1, cv2.LINE_AA)
            y += line_h
    except Exception:
        # Overlay is non-critical; ignore any drawing errors to avoid crashing the app
        pass


# Choose a colormap (e.g., 'viridis', 'plasma', 'coolwarm')
colormap = cm.get_cmap('Blues')

# Initialize MediaPipe Hands
mp_drawing = mp.solutions.drawing_utils
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(min_detection_confidence=0.7, min_tracking_confidence=0.5)
drawing_styles = mp.solutions.drawing_styles


# Initialize OpenCV Webcam
camera_index = 0
cap = cv2.VideoCapture(camera_index)
if not cap.isOpened():
    print(f"[Init][Error] Could not open camera at index {camera_index}.")
    raise SystemExit(1)
print(f"[Init] Camera index: {camera_index}")

# Initial position and size of the object
object_center = np.array([0, 0, 5])  # Positioned in front of the camera initially
initial_object_size = 1
object_size = initial_object_size # Current radius, starts at initial
obj_x, obj_y, obj_z = create_object.create_specific(0, object_center, 0.1, 50)
# Variables for scaling gesture
current_scale = 1.0
prev_pinch_distance = None
# Variables for 3d to 2d projection
focal_length = 500
center_x = 320
center_y = 240
# initialize n = 0
n = 0
# Variables for video processing
frame_timestamp_ms = 0

# Current rotation angles
angles = [0, 0, 0]  # [x, y, z] rotation angles in degrees
current_angles = angles

# Rotation speed (degrees per frame)
rotation_speed = 2.0
active_axis = 0  # 0: X, 1: Y, 2: Z
rotation_active = False
last_gesture = None

# Resolve gesture model path with sensible defaults and overrides
def _resolve_gesture_model_path() -> str:
    """
    Determine the gesture recognizer model path using the following precedence:
    1) Environment variable GESTURE_MODEL_PATH (if file exists)
    2) Default relative path: <repo>/assets/models/gesture_recognizer.task

    Returns the path if found; raises FileNotFoundError otherwise with a helpful message.
    """
    # 1) Environment override
    env_path = os.getenv("GESTURE_MODEL_PATH")
    candidates = []
    if env_path:
        candidates.append(env_path)

    # 2) Default relative path next to this file: assets/models/gesture_recognizer.task
    default_rel = os.path.join(os.path.dirname(__file__), "assets", "models", "gesture_recognizer.task")
    candidates.append(default_rel)

    for p in candidates:
        if p and os.path.isfile(p):
            return p

    # If nothing found, construct a clear message
    msg_lines = [
        "Gesture model file not found.",
        "Tried paths:",
    ] + [f" - {p}" for p in candidates] + [
        "\nHow to fix:",
        "1) Download the MediaPipe Gesture Recognizer model (gesture_recognizer.task)",
        "2) Place it at: assets/models/gesture_recognizer.task (recommended)",
        "   OR set an absolute path in the environment variable GESTURE_MODEL_PATH",
        "   See README for details: https://developers.google.com/mediapipe/solutions/vision/gesture_recognizer",
    ]
    raise FileNotFoundError("\n".join(msg_lines))

try:
    model_path = _resolve_gesture_model_path()
    print(f"[Init] Using gesture model: {model_path}")
except FileNotFoundError as e:
    # Print helpful guidance and exit gracefully
    print(str(e))
    # Ensure a non-zero exit so users notice the issue
    raise SystemExit(1)

# Initialize MediaPipe objects
BaseOptions = python.BaseOptions
GestureRecognizer = vision.GestureRecognizer
GestureRecognizerOptions = vision.GestureRecognizerOptions
RunningMode = vision.RunningMode

# Create gesture recognizer with absolute path
options = GestureRecognizerOptions(
    base_options=BaseOptions(model_asset_buffer=open(model_path, "rb").read()),
    running_mode=RunningMode.VIDEO,  # Use VIDEO mode for faster processing
    num_hands=2  # Detect up to 2 hands
)

recognizer = GestureRecognizer.create_from_options(options)

# Control state variables
gesture_hold_frames = 0
gesture_cooldown = 0

print("\nGesture Controls:")
print("- 'Open_Palm': Reset rotations")
print("- 'Closed_Fist': Toggle rotation on/off")
print("- 'Victory': Switch between cube and sphere")
print("- 'Pointing_Up': Cycle between X, Y, Z rotation axes")
print("- 'Thumb_Up': Increase rotation speed")
print("- 'Thumb_Down': Decrease rotation speed")
print("- Press escape to exit")

while cap.isOpened():

    success, image = cap.read()
    if not success:
        print("Ignoring empty camera frame.")
        continue

    # Flip the image horizontally for a later selfie-view display
    image = cv2.flip(image, 1)
    rgb_frame = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    # Process hand landmarks
    results = hands.process(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))

    # Process gesture recognition
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
    recognition_result = recognizer.recognize_for_video(mp_image, frame_timestamp_ms)

    frame_timestamp_ms += 33

    # Decrease cooldown counter if active
    if gesture_cooldown > 0:
        gesture_cooldown -= 1

    # Get keyboard input
    key = cv2.waitKey(5) & 0xFF

    if key == ord('s'):  # 's' for sphere (n=0)
        n = 0
    elif key == ord('c'):  # 'c' for cube (n=1)
        n = 1
    elif key == ord('m'):  # 'm' for mobius
        n = 2
    elif key == 27:  # Escape key to exit
        break

    current_gesture = None
    if recognition_result.gestures:
        for hand_idx, hand_gesture in enumerate(recognition_result.gestures):
            if hand_gesture:
                # Get top gesture
                top_gesture = hand_gesture[0]
                gesture_name = top_gesture.category_name
                gesture_score = top_gesture.score

                # Only process the first hand's gesture
                if hand_idx == 0 and gesture_score > 0.7:  # Confidence threshold
                    current_gesture = gesture_name

                    # Display on frame
                    cv2.putText(image, f"{gesture_name} ({gesture_score:.2f})",
                                (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

    # Process gestures with cooldown to avoid rapid toggling
    if current_gesture and current_gesture == last_gesture:
        gesture_hold_frames += 1
    else:
        gesture_hold_frames = 0

    # Process gesture if it's consistent for multiple frames and cooldown expired
    if current_gesture and gesture_hold_frames > 5 and gesture_cooldown == 0:
        gesture_cooldown = 10  # Set cooldown period

        if current_gesture == "Open_Palm":
            # Reset rotations
            angles = [0, 0, 0]
            print("Reset rotations")

        elif current_gesture == "Closed_Fist":
            # Toggle rotation
            rotation_active = not rotation_active
            print(f"Rotation {'activated' if rotation_active else 'deactivated'}")

        elif current_gesture == "Victory":
            # Toggle between objects
            n += 1
            if n == 3:
                n = 0
            print(f"Switched objects")

        elif current_gesture == "Pointing_Up":
            # Cycle between rotation axes
            active_axis = (active_axis + 1) % 3
            axis_name = ["X", "Y", "Z"][active_axis]
            print(f"Switched to {axis_name}-axis rotation")

        elif current_gesture == "Thumb_Up":
            # Increase rotation speed
            rotation_speed = min(rotation_speed + 0.5, 10.0)
            print(f"Rotation speed: {rotation_speed:.1f}")

        elif current_gesture == "Thumb_Down":
            # Decrease rotation speed
            rotation_speed = max(rotation_speed - 0.5, 0.5)
            print(f"Rotation speed: {rotation_speed:.1f}")

    last_gesture = current_gesture



    if results.multi_hand_landmarks and results.multi_handedness:
        for i, hand_landmarks in enumerate(results.multi_hand_landmarks):
            hand_label = results.multi_handedness[i].classification[0].label
            if hand_label == 'Right':
                index_finger_tip = hand_landmarks.landmark[mp_hands.HandLandmark.INDEX_FINGER_TIP]
                h, w, c = image.shape
                index_finger_x_px, index_finger_y_px = int(index_finger_tip.x * w), int(index_finger_tip.y * h)

                # Update obj center based on the right hand's index finger
                # noinspection PyUnboundLocalVariable
                object_center = np.array([(index_finger_x_px - w // 2) / 100,
                                          (index_finger_y_px - h // 2) / 100 - object_size/2,
                                          5])  # Assuming you've corrected the z-value

                obj_x, obj_y, obj_z = create_object.create_specific(n, object_center, object_size, resolution=50)

                points_3d = np.stack([obj_x.flatten(), obj_y.flatten(), obj_z.flatten()], axis=-1)
                projected_points = []
                depth_values = []

                # Update rotation angles
                if rotation_active:
                    angles[active_axis] += rotation_speed
                    angles[active_axis] %= 360  # Keep angles between 0-360
                    current_angles = angles

                # Rotate and project objects
                rotated_object = projection.rotate_points(points_3d, angles, object_center)
                projected_points = projection.project_3d_to_2d(rotated_object)
                points_2d = np.array(projected_points, dtype=np.int32)
                depth_values.append(rotated_object[:, 2])  # Store the z-dept
                depth_values = depth_values[0].tolist()

                depth_values = np.array(depth_values)


                # Normalize depth values for color intensity (closer is brighter)
                if depth_values.size > 0:
                    min_depth = np.min(depth_values)
                    max_depth = np.max(depth_values)
                    normalized_depth = (depth_values - min_depth) / (
                                max_depth - min_depth) if max_depth > min_depth else np.ones_like(depth_values)
                    brightness = (1 - normalized_depth) * 255  # Closer (larger z) will be closer to 255
                    #print(normalized_depth.shape)

                    for i, point in enumerate(points_2d):
                        # Get the color from the colormap based on the normalized depth
                        color_float = colormap(normalized_depth[i])[:3]  # Get RGB values (ignore alpha if present)
                        r, g, b = color_float
                        color_bgr_float = (b, g, r)
                        color_int = tuple(int(c * 255) for c in color_bgr_float)  # Convert to 0-255 integers
                        cv2.circle(image, tuple(point), 2, color_int, -1)


                mp_drawing.draw_landmarks(image, hand_landmarks, mp_hands.HAND_CONNECTIONS) #
                # Since we only care about the right hand, we can break out of the loop
                break
            else:
                # If it's a left hand, you could optionally draw its landmarks
                mp_drawing.draw_landmarks(image, hand_landmarks, mp_hands.HAND_CONNECTIONS,
                                          mp_drawing.DrawingSpec(color=(0, 0, 255), thickness=2, circle_radius=2),
                                          mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=2))
                # Inside the hand processing loop, assuming 'hand_landmarks' is for the relevant hand
                try:
                    thumb_tip_3d = hand_landmarks.landmark[mp_hands.HandLandmark.THUMB_TIP]
                    index_tip_3d = hand_landmarks.landmark[mp_hands.HandLandmark.INDEX_FINGER_TIP]

                    # Calculate 3D Euclidean distance
                    current_pinch_distance_3d = np.linalg.norm(
                        np.array([thumb_tip_3d.x, thumb_tip_3d.y, thumb_tip_3d.z]) -
                        np.array([index_tip_3d.x, index_tip_3d.y, index_tip_3d.z])
                    )

                    # After calculating current_pinch_distance_3d
                    if current_pinch_distance_3d is not None:
                        if prev_pinch_distance is None:
                            # First frame with a valid pinch distance
                            prev_pinch_distance = current_pinch_distance_3d
                            current_scale = 1.0  # Start with original size

                        else:
                            # Calculate the ratio of the current distance to the previous distance
                            # This gives us the relative change in finger separation
                            ratio = current_pinch_distance_3d / prev_pinch_distance

                            # Update the scale factor based on this ratio
                            # We multiply the current scale by the ratio
                            current_scale *= ratio

                            # Optional: Clamp the scale to prevent it from becoming too large or too small
                            max_scale = 3.0  # Prevent excessive growth
                            min_scale = 0.1  # Prevent disappearing
                            current_scale = max(min_scale, min(max_scale, current_scale))

                            # Store the current distance for the next frame
                            prev_pinch_distance = current_pinch_distance_3d

                        # Update the obj radius based on the new scale
                        object_size = initial_object_size * current_scale

                    else:
                        # If landmarks are not detected, reset the previous distance
                        prev_pinch_distance = None
                except:
                    # Handle cases where landmarks might be missing temporarily
                    current_pinch_distance_3d = None
                    prev_pinch_distance = None  # Reset if hand tracking is unstable



    # Draw help overlay (non-intrusive)
    draw_help_overlay(image, rotation_active, rotation_speed, active_axis, last_gesture)

    cv2.imshow('MediaPipe Hands', image)
    if cv2.waitKey(5) & 0xFF == 27:
        break

cap.release()
cv2.destroyAllWindows()
#plt.close(fig)