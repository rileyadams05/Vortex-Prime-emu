from comtypes import GUID, COMMETHOD, IUnknown
from comtypes import CoCreateInstance, CLSCTX_ALL
import comtypes.client
from ctypes import wintypes
import ctypes

# Constants
CLSID_MMDeviceEnumerator = GUID("{BCDE0395-E52F-467C-8E3D-C4579291692E}")
IMMDeviceEnumerator_IID = GUID("{A95664D2-9614-4F35-A746-DE8DB63617E6}")
IPropertyStore_IID = GUID("{886d8eeb-8cf2-4446-8d02-cdba1dbdcf99}")

eRender = 0
DEVICE_STATE_ACTIVE = 1
STGM_READ = 0

class PROPERTYKEY(ctypes.Structure):
    _fields_ = [("fmtid", GUID),
                ("pid", wintypes.DWORD)]

class PROPVARIANT(ctypes.Structure):
    _fields_ = [("vt", wintypes.WORD),
                ("wReserved1", wintypes.WORD),
                ("wReserved2", wintypes.WORD),
                ("wReserved3", wintypes.WORD),
                ("data", ctypes.c_ulonglong * 2)] # Rough approximation for pointers

class IPropertyStore(IUnknown):
    _iid_ = IPropertyStore_IID
    _methods_ = [
        COMMETHOD([], ctypes.HRESULT, 'GetCount',
                  (['out'], ctypes.POINTER(wintypes.DWORD), 'cProps')),
        COMMETHOD([], ctypes.HRESULT, 'GetAt',
                  (['in'], wintypes.DWORD, 'iProp'),
                  (['out'], ctypes.POINTER(PROPERTYKEY), 'pkey')),
        COMMETHOD([], ctypes.HRESULT, 'GetValue',
                  (['in'], ctypes.POINTER(PROPERTYKEY), 'key'),
                  (['out'], ctypes.POINTER(PROPVARIANT), 'pv')),
    ]

# Pycaw doesn't expose IMMDeviceCollection completely wrapped, so we define enough to get by
# Or rely on comtypes dynamic dispatch if possible, but interfaces are safer.

from pycaw.pycaw import IMMDeviceEnumerator, IMMDeviceCollection, IMMDevice

def get_device_names():
    enumerator = CoCreateInstance(
        CLSID_MMDeviceEnumerator,
        IMMDeviceEnumerator,
        CLSCTX_ALL
    )
    
    collection = enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)
    count = collection.GetCount()
    
    devices = []
    
    # PKEY_Device_FriendlyName
    PKEY_Device_FriendlyName = PROPERTYKEY()
    PKEY_Device_FriendlyName.fmtid = GUID("{a45c254e-df1c-4efd-8020-67d146a850e0}")
    PKEY_Device_FriendlyName.pid = 14
    
    for i in range(count):
        dev = collection.Item(i)
        dev_id = dev.GetId()
        
        # Open Property Store
        store = dev.OpenPropertyStore(STGM_READ)
        # Cast to IPropertyStore interface defined above? 
        # dev.OpenPropertyStore returns an IUnknown pointer, we need to QI or Cast
        
        # Actually pycaw might return the object.
        # Let's try to access it via IPropertyStore interface
        
        # Quick hack: standard pycaw implementation of OpenPropertyStore returns a POINTER(IPropertyStore)
        # But we need the definition.
        
        # If we can't easily get the name via property store in this script without defining PROPVARIANT properly,
        # we might just return IDs for now to verify.
        # BUT the user needs names.
        
        # Let's try a simpler approach using comtypes 'dynamic' if possible, or robust definition.
        # PROPVARIANT is complex.
        
        devices.append({"id": dev_id, "name": f"Device {i}"}) # Placeholder
        
    return devices

if __name__ == "__main__":
    devs = get_device_names()
    print(devs)
