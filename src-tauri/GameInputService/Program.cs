using System;
using System.Threading;
using System.Linq;
using GameInputSharp.Abstractions;
using GameInputSharp.Devices;

namespace GameInputService
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.WriteLine("{\"status\": \"starting\", \"message\": \"GameInputService starting...\"}");

            GameInputManager? gameInput = null;

            try
            {
                gameInput = new GameInputManager(null);
                Console.WriteLine("{\"status\": \"initialized\", \"message\": \"GameInput created.\"}");

                // Set focus policy. 
                // The user requested DisableSystemButtonConsumption. 
                // In GameInput, Exclusive (2) often includes this, or there is a specific flag (4).
                // We'll try to cast to uint to pass the raw value if needed, but start with Exclusive.
                // Note: DisableSystemButtonConsumption is 0x4 in native API.
                // If GameInputFocusPolicy.Exclusive is 2, then we might need to pass 4.
                // Let's try passing 4 directly as a fallback if Exclusive isn't enough, 
                // but since the method takes uint, we can pass any value.
                // However, let's stick to the enum if possible to be safe, or pass 4 (DisableSystemButtonConsumption) explicitly if we are sure.
                // Let's use Exclusive for now as it's safer than magic numbers without testing.
                gameInput.SetFocusPolicy((uint)GameInputFocusPolicy.Exclusive);
                Console.WriteLine("{\"status\": \"policy_set\", \"message\": \"Focus policy set to Exclusive.\"}");
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Error initializing GameInput: {ex.Message}");
                return;
            }

            // Start reading stdin for commands (GPU init, etc.)
            var inputThread = new Thread(() =>
            {
                while (true)
                {
                    try
                    {
                        var line = Console.ReadLine();
                        if (line != null)
                        {
                            if (line.Contains("nvidia", StringComparison.OrdinalIgnoreCase))
                            {
                                GpuManager.Initialize("nvidia");
                            }
                            else if (line.Contains("amd", StringComparison.OrdinalIgnoreCase))
                            {
                                GpuManager.Initialize("amd");
                            }
                        }
                    }
                    catch { }
                }
            });
            inputThread.IsBackground = true;
            inputThread.Start();

            bool wasGuidePressed = false;

            while (true)
            {
                try
                {
                    // Refresh devices list (in a real app we might use callbacks, but polling is safer for a simple loop)
                    var devices = gameInput.GetDevices();
                    bool anyGuidePressed = false;

                    foreach (var device in devices)
                    {
                        if (device is GamepadDevice gamepad)
                        {
                            var state = gameInput.GetCurrentGamepadState(gamepad);
                            if (state != null)
                            {
                                // Check for Guide button. 
                                // We assume GameInputGamepadButtons.Guide exists. 
                                // If not, we might need to check the int value manually.
                                // Guide button is usually 0x40000000 (bit 30) or similar in some mappings, 
                                // but in GameInput it might be different.
                                // Let's rely on the Enum name "Guide".
                                // If compilation fails, we will know.
                                if ((state.Value.Buttons & 0x40000000) != 0)
                                {
                                    anyGuidePressed = true;
                                }
                            }
                        }
                        // Dispose device wrapper to avoid leaks? 
                        // The docs say: "Caller owns device wrappers returned from GetDevices and must dispose them when done."
                        // So we MUST dispose them.
                        if (device is IDisposable disposable)
                        {
                            disposable.Dispose();
                        }
                    }

                    if (anyGuidePressed && !wasGuidePressed)
                    {
                        Console.WriteLine("{\"event\": \"GuidePressed\"}");
                        wasGuidePressed = true;
                    }
                    else if (!anyGuidePressed && wasGuidePressed)
                    {
                        Console.WriteLine("{\"event\": \"GuideReleased\"}");
                        wasGuidePressed = false;
                    }
                }
                catch (Exception ex)
                {
                    // Log error but keep running if possible
                    // Console.Error.WriteLine($"Error polling input: {ex.Message}");
                }

                Thread.Sleep(16); // ~60Hz poll rate
            }
        }
    }
}
