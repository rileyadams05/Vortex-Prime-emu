using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Linq;
using System.Security.Principal;
using Avalonia;
using Velopack;

namespace PS3QuickTool
{
    internal static class Program
    {
        [STAThread]
        public static void Main(string[] args)
        {
            if (OperatingSystem.IsWindows())
            {
                TryRunElevated(ref args);
            }
            VelopackApp.Build().Run();
            BuildAvaloniaApp()
                .StartWithClassicDesktopLifetime(args);
        }

        private static void TryRunElevated(ref string[] args)
        {
            try
            {
                using var identity = WindowsIdentity.GetCurrent();
                var principal = new WindowsPrincipal(identity);
                bool isAdmin = principal.IsInRole(WindowsBuiltInRole.Administrator);
                bool alreadyFlagged = args.Any(a => a == "--elevated");
                if (!isAdmin && !alreadyFlagged)
                {
                    var exe = Environment.ProcessPath ?? Process.GetCurrentProcess().MainModule?.FileName;
                    if (string.IsNullOrEmpty(exe)) return;
                    var psi = new ProcessStartInfo(exe)
                    {
                        UseShellExecute = true,
                        Verb = "runas",
                        Arguments = string.Join(' ', args.Append("--elevated"))
                    };
                    Process.Start(psi);
                    Environment.Exit(0);
                }
            }
            catch (Win32Exception)
            {
                // User canceled UAC prompt; continue non-elevated
            }
            catch
            {
                // Ignore elevation errors
            }
        }

        public static AppBuilder BuildAvaloniaApp()
            => AppBuilder.Configure<App>()
                .UsePlatformDetect()
                .LogToTrace();
    }
}
