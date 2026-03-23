from pycaw.pycaw import AudioUtilities, ISimpleAudioVolume

try:
    sessions = AudioUtilities.GetAllSessions()
    print(f"Sessions count: {len(sessions)}")
    for session in sessions:
        if session.Process:
            print(f"Session: {session.Process.name()}")
            volume = session._ctl.QueryInterface(ISimpleAudioVolume)
            print(f"Volume: {volume.GetMasterVolume()}")
except Exception as e:
    print(f"Error: {e}")
