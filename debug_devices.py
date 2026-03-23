from comtypes import CLSCTX_ALL, CoCreateInstance
from pycaw.pycaw import AudioUtilities, IMMDeviceEnumerator
import comtypes.client

# Constants
CLSID_MMDeviceEnumerator = "{BCDE0395-E52F-467C-8E3D-C4579291692E}"
IMMDeviceEnumerator_IID = "{A95664D2-9614-4F35-A746-DE8DB63617E6}"
eRender = 0
eMultimedia = 1
DEVICE_STATE_ACTIVE = 1

try:
    enumerator = comtypes.client.CreateObject(
        CLSID_MMDeviceEnumerator,
        interface=IMMDeviceEnumerator
    )
    
    collection = enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)
    count = collection.GetCount()
    
    print(f"Found {count} active output devices:")
    
    for i in range(count):
        dev = collection.Item(i)
        
        # Get ID
        dev_id = dev.GetId()
        
        # Get Name (Property Store)
        # PKEY_Device_FriendlyName "{a45c254e-df1c-4efd-8020-67d146a850e0}, 14"
        store = dev.OpenPropertyStore(0) # STGM_READ
        # We need to manually get the property. 
        # pycaw encapsulates some of this but let's see if we can just get the FriendlyName easily.
        # or use pycaw's AudioUtilities if it exposes listing.
        
        print(f"Device {i}: ID={dev_id}")
        
except Exception as e:
    print(f"Error: {e}")
