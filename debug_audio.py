from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
from comtypes import CLSCTX_ALL
from ctypes import cast, POINTER

try:
    devices = AudioUtilities.GetSpeakers()
    print(f"Devices type: {type(devices)}")
    print(f"Devices dir: {dir(devices)}")
    
    interface = devices.Activate(
        IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
    volume = cast(interface, POINTER(IAudioEndpointVolume))
    print(f"Volume: {volume.GetMasterVolumeLevelScalar()}")
except Exception as e:
    print(f"Error: {e}")
