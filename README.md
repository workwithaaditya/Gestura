# 3D Object Manipulation with Hand Gestures

A computer vision application that allows users to manipulate 3D objects in real-time using hand gestures captured by a webcam.

![Demo](assets/demo.gif)

## Features

- **Real-time 3D object manipulation** using hand gestures
- **Multiple object types**: Switch between cube and sphere
- **Gesture controls**:
  - Move objects by pointing
  - Scale objects with pinch gestures
  - Rotate objects in 3D space
  - Change rotation axis
  - Adjust rotation speed
- **Visual depth cues** with color gradient rendering
- **MediaPipe integration** for accurate hand tracking and gesture recognition

## Requirements

- Python 3.8+
- OpenCV
- MediaPipe
- NumPy
- Matplotlib
- Open3D

## Installation

1) Clone the repository:
```bash
git clone https://github.com/yourusername/3d-gesture-control.git
cd 3d-gesture-control
```

2) (Recommended) Create and activate a virtual environment, then install dependencies:

Windows PowerShell
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r .\requirements.txt
```

macOS/Linux
```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

3) Download the MediaPipe gesture recognizer model:
   - Obtain the `gesture_recognizer.task` file from the official docs: [MediaPipe Gesture Recognizer](https://developers.google.com/mediapipe/solutions/vision/gesture_recognizer)
   - Default expected path (recommended):
     ```
     assets/models/gesture_recognizer.task
     ```
   - Alternatively, keep it anywhere and set the environment variable `GESTURE_MODEL_PATH` to point to it.
     
     Windows PowerShell
     ```powershell
     $env:GESTURE_MODEL_PATH = "C:\\full\\path\\to\\gesture_recognizer.task"
     ```
     macOS/Linux
     ```bash
     export GESTURE_MODEL_PATH="/full/path/to/gesture_recognizer.task"
     ```

## Usage

Run the main application:

Windows PowerShell
```powershell
python .\3d-gesture-control.py
```

macOS/Linux
```bash
python3 3d-gesture-control.py
```

### One-command setup and run (Windows)

From the project folder:

```powershell
# Setup venv, install requirements, and ensure model folder exists
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1

# Run (optionally pass a model path override)
powershell -ExecutionPolicy Bypass -File .\scripts\run.ps1
# or
powershell -ExecutionPolicy Bypass -File .\scripts\run.ps1 -ModelPath "C:\\full\\path\\to\\gesture_recognizer.task"
```

### Controls

| Gesture | Action                              |
|---------|-------------------------------------|
| Open Palm | Reset rotations                     |
| Closed Fist | Toggle rotation on/off              |
| Victory Sign | Switch between objects              |
| Pointing Up | Cycle between X, Y, Z rotation axes |
| Thumb Up | Increase rotation speed             |
| Thumb Down | Decrease rotation speed             |
| Right Hand Movement | Move the object                     |
| Thumb-Index Pinch | Scale the object                    |
| Press ESC | Exit application                    |

## Project Structure

- `3d-gesture-control.py`: Main application entry point
- `create_object.py`: Contains functions for creating 3D objects
- `projection.py`: Handles 3D to 2D projection and rotation
- `requirements.txt`: List of required packages
- `assets/models/`: Place `gesture_recognizer.task` here by default
- `tests/`: Pytest unit tests
- `docs/`: Documentation and usage guides
- `scripts/`: Windows PowerShell helpers for setup and running

## Deployment options

- Local (recommended):
  - Use `scripts/setup.ps1` and `scripts/run.ps1` on Windows for a quick start, or follow the manual venv steps above on any OS.

- Single-file executable (Windows, optional):
  - Install PyInstaller into the venv and build:
    ```powershell
    .\.venv\Scripts\Activate.ps1
    python -m pip install pyinstaller
    pyinstaller --onefile --name 3d-gesture-control `
      --add-data "assets\models\gesture_recognizer.task;assets\models" `
      3d-gesture-control.py
    ```
  - Distribute `dist\3d-gesture-control.exe` along with camera permissions. Note: packaging MediaPipe/Open3D can increase size; Möbius mesh downloads at first run.

- Docker (not recommended for GUI+webcam):
  - This app requires webcam and a GUI window, which complicates Docker on Windows. Prefer local install.

## How It Works

The application uses MediaPipe to track hand landmarks and recognize gestures in real-time. The right hand controls the object's position, while the left hand controls scaling through pinch gestures. Various predefined gestures trigger different actions like changing objects, toggling rotation, or changing rotation axes.

The 3D objects are created with parametric equations, transformed in 3D space, and then projected onto the 2D screen with proper depth cues using color gradients.

## Extending the Project

To add new object types, modify the `create_object.py` file with your new object's parametric equations or mesh data. The main application can be extended to support additional gestures by modifying the gesture recognition handling in `3d-gesture-control.py`.

## License

[GNU General Public Licence v3.0](LICENSE)

## Acknowledgments

- [MediaPipe](https://mediapipe.dev/) for hand tracking and gesture recognition
- [OpenCV](https://opencv.org/) for image processing
- [NumPy](https://numpy.org/) for numerical operations
- [Matplotlib](https://matplotlib.org/) for visualization
- Open3D for importing 3D models
