
using System;
using System.Diagnostics;
using System.Linq;
using NvAPIWrapper.DRS;
using NvAPIWrapper.GPU;
using NvAPIWrapper.Native;
using NvAPIWrapper.Native.DRS;
using NvAPIWrapper.Native.DRS.Structures;
using NvAPIWrapper.Native.GPU;
using NvAPIWrapper.Native.Interfaces.GPU;

namespace GameInputService
{
    public static class GpuManager
    {
        public static void Initialize(string gpuType)
        {
            try
            {
                if (gpuType.ToLower() == "nvidia")
                {
                    InitializeNvidia();
                }
                else if (gpuType.ToLower() == "amd")
                {
                    InitializeAmd();
                }
                else if (gpuType.ToLower() == "open_nv_panel")
                {
                    OpenNvidiaControlPanel();
                }
                 else if (gpuType.ToLower() == "open_amd_panel")
                {
                    OpenAmdControlPanel();
                }
                else
                {
                    Console.WriteLine($"{{\"status\": \"error\", \"message\": \"Unknown GPU type: {gpuType}\"}}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"{{\"status\": \"error\", \"message\": \"GPU Init failed: {ex.Message}\"}}");
            }
        }

        private static void InitializeNvidia()
        {
            try
            {
                if (!NvAPIWrapper.NVIDIA.IsAvailable)
                {
                    Console.WriteLine("{\"status\": \"warning\", \"message\": \"NVIDIA API not available.\"}");
                    return;
                }

                // Create a Driver Settings Session
                using (var session = DriverSettingsSession.CreateAndLoad())
                {
                    var profileName = "Vortex Prime (Xenia)";
                    var appName = "xenia-canary.exe";

                    // 1. Find or Create Profile
                    var profile = session.GetProfiles().FirstOrDefault(p => p.ProfileName.Equals(profileName, StringComparison.OrdinalIgnoreCase));
                    
                    if (profile == null)
                    {
                        profile = session.CreateProfile(profileName);
                        Console.WriteLine("{\"status\": \"info\", \"message\": \"Created new NVIDIA Driver Profile.\"}");
                    }

                    // 2. Add Application if not present
                    if (!profile.GetApplications().Any(app => app.ApplicationName.Equals(appName, StringComparison.OrdinalIgnoreCase)))
                    {
                        profile.AddApplication(new DriverSettingsApplication(appName));
                        Console.WriteLine("{\"status\": \"info\", \"message\": \"Added xenia-canary.exe to profile.\"}");
                    }

                    // 3. Apply High Performance Settings
                    // Power Management Mode: Prefer Maximum Performance (0x102007F9 = 1)
                    var powerSettingId = new SettingId(0x102007F9); 
                    if (!profile.GetSettings().Any(s => s.SettingId.Equals(powerSettingId)))
                    {
                        profile.SetSetting(new DriverSetting(powerSettingId, 1)); // 1 = Max Performance
                    }

                    // Threaded Optimization: On (0x1057EB46 = 1)
                    var threadedOptId = new SettingId(0x1057EB46);
                    if (!profile.GetSettings().Any(s => s.SettingId.Equals(threadedOptId)))
                    {
                        profile.SetSetting(new DriverSetting(threadedOptId, 1)); // 1 = On
                    }
                    
                    // Vertical Sync: Force Off (0x1057EB46 - Wait, VSync is 0x00A879CF)
                    // Let's use the predefined SettingId if available or look up the ID.
                    // Common VSync ID: 0x00A879CF. 0 = Use 3D App Setting, 1 = Force Off, 2 = Force On...
                    // We will set to 'Use the 3D application setting' (0) to let Xenia handle it, or Force Off (1) for latency.
                    // User asked for "Best Performance", so Force Off is often preferred, but Xenia needs VSync for timing sometimes.
                    // Let's stick to Power Management as the critical one.

                    session.Save();
                }

                Console.WriteLine("{\"status\": \"success\", \"message\": \"NVIDIA Driver Profile Optimized Successfully.\"}");
            }
            catch (Exception ex)
            {
                // Fallback: If DRS fails (e.g. permissions), just log it.
                Console.WriteLine($"{{\"status\": \"error\", \"message\": \"NVIDIA Profile Error: {ex.Message}\"}}");
                throw;
            }
        }

        private static void InitializeAmd()
        {
             // AMD ADLX is complex to implement without the DLL references. 
             // We will instruct the user or attempt to launch the software.
             Console.WriteLine("{\"status\": \"info\", \"message\": \"AMD Optimization: Please configure via AMD Software.\"}");
             OpenAmdControlPanel();
        }

        private static void OpenNvidiaControlPanel()
        {
            try 
            {
                Process.Start("nvcplui.exe"); // Modern NVIDIA UI
                // Or "control.exe" with args, but nvcplui is standard now.
                Console.WriteLine("{\"status\": \"success\", \"message\": \"Launched NVIDIA Control Panel\"}");
            }
            catch 
            {
                try 
                {
                    Process.Start("control.exe", "/name Microsoft.NVIDIAControlPanel");
                    Console.WriteLine("{\"status\": \"success\", \"message\": \"Launched NVIDIA Control Panel (Legacy)\"}");
                }
                catch (Exception ex)
                {
                     Console.WriteLine($"{{\"status\": \"error\", \"message\": \"Failed to launch NVCP: {ex.Message}\"}}");
                }
            }
        }

        private static void OpenAmdControlPanel()
        {
             try 
            {
                // Protocol handler for AMD Radeon Software
                Process.Start(new ProcessStartInfo("amd-software:") { UseShellExecute = true });
                 Console.WriteLine("{\"status\": \"success\", \"message\": \"Launched AMD Software\"}");
            }
            catch 
            {
                try
                {
                    Process.Start("RadeonSoftware.exe");
                    Console.WriteLine("{\"status\": \"success\", \"message\": \"Launched Radeon Software\"}");
                }
                catch (Exception ex)
                {
                     Console.WriteLine($"{{\"status\": \"error\", \"message\": \"Failed to launch AMD Software: {ex.Message}\"}}");
                }
            }
        }
    }
}
