from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
from comtypes import CLSCTX_ALL
from ctypes import cast, POINTER

try:
    device = AudioUtilities.GetSpeakers()
    interface = device.EndpointVolume
    print(f"Interface: {interface}")
    
    # Try using interface directly if it's already the volume control
    volume = cast(interface, POINTER(IAudioEndpointVolume))
    level = volume.GetMasterVolumeLevelScalar()
    print(f"Volume: {level}")
except Exception as e:
    print(f"Error: {e}")
