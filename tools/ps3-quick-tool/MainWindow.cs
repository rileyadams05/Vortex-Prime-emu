using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using System.Diagnostics;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Velopack;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace PS3QuickTool
{
    public partial class MainWindow : Window
    {
        private readonly HttpClient _http = new HttpClient();
        private ComboBox? _driveCombo;
        private TextBox? _urlInput;
        private ProgressBar? _progressBar;
        private TextBox? _logText;

        public MainWindow()
        {
            InitializeComponent();
            _driveCombo = this.FindControl<ComboBox>("DriveCombo");
            _urlInput = this.FindControl<TextBox>("UrlInput");
            _progressBar = this.FindControl<ProgressBar>("ProgressBar");
            _logText = this.FindControl<TextBox>("LogText");
            this.Opened += async (_, __) =>
            {
                await PopulateDrivesAsync();
                await CheckForUpdatesAsync();
            };
        }

        private List<DriveItem> ParseMacDisks(string diskutilOutput)
        {
            var items = new List<DriveItem>();
            // Lines like: "/dev/disk2 (external, physical):" then indented partitions under
            foreach (var line in diskutilOutput.Split('\n'))
            {
                var m = Regex.Match(line.Trim(), @"^/dev/(disk\d+)\s+\(external,\s*physical\)");
                if (m.Success)
                {
                    var dev = "/dev/" + m.Groups[1].Value;
                    items.Add(new DriveItem(display: $"{dev} (external)", rootPath: dev, driveLetter: '\0'));
                }
            }
            return items;
        }

        private List<DriveItem> ParseLinuxDisks(string lsblkJson)
        {
            var items = new List<DriveItem>();
            try
            {
                using var doc = JsonDocument.Parse(lsblkJson);
                if (doc.RootElement.TryGetProperty("blockdevices", out var bds))
                {
                    foreach (var bd in bds.EnumerateArray())
                    {
                        var type = bd.TryGetProperty("type", out var t) ? t.GetString() : null;
                        var rm = bd.TryGetProperty("rm", out var r) ? r.GetInt32() : 0;
                        if (type == "disk" && rm == 1)
                        {
                            var name = bd.TryGetProperty("name", out var n) ? n.GetString() : null;
                            var size = bd.TryGetProperty("size", out var s) ? s.GetString() : null;
                            var model = bd.TryGetProperty("model", out var m) ? m.GetString() : null;
                            if (!string.IsNullOrWhiteSpace(name))
                            {
                                var dev = "/dev/" + name;
                                var disp = $"{dev} [{model}] ({size})".Trim();
                                items.Add(new DriveItem(display: disp, rootPath: dev, driveLetter: '\0'));
                            }
                        }
                    }
                }
            }
            catch
            {
                // ignore parse errors
            }
            return items;
        }

        private async Task<string?> FormatDriveMacAsync(DriveItem item)
        {
            try
            {
                Log($"Formatting {item.Display} to FAT32/MBR (macOS)...");
                SetProgress(0);
                var outp = await RunProcessAsync("diskutil", $"eraseDisk FAT32 PS3 MBRFormat {item.RootPath}", true);
                Log(outp);
                SetProgress(5);
                // Default mount point
                var defaultVol = "/Volumes/PS3";
                if (Directory.Exists(defaultVol)) return defaultVol;
                var vols = Directory.Exists("/Volumes") ? Directory.GetDirectories("/Volumes", "PS3*") : Array.Empty<string>();
                return vols.FirstOrDefault();
            }
            catch (Exception ex)
            {
                Log($"macOS format error: {ex.Message}");
                return null;
            }
        }

        private async Task<string?> FormatDriveLinuxAsync(DriveItem item)
        {
            try
            {
                Log($"Formatting {item.Display} to FAT32/MBR (Linux)...");
                SetProgress(0);
                var dev = item.RootPath; // e.g. /dev/sdb
                var part = dev + "1";    // assume /dev/sdb1

                // Create MBR + single FAT32 partition using pkexec (GUI elevate)
                var cmd = $"parted -s {dev} mklabel msdos mkpart primary fat32 1MiB 100% && mkfs.vfat -F 32 -n PS3 {part}";
                var outp = await RunProcessAsync("pkexec", $"bash -lc \"{cmd}\"", true);
                Log(outp);
                SetProgress(5);

                // Try to mount via udisksctl (no root typically required)
                var mountOut = await RunProcessAsync("udisksctl", $"mount -b {part}", true);
                var m = Regex.Match(mountOut, @"Mounted .* at (.*)\\.");
                if (m.Success) return m.Groups[1].Value.Trim();

                // Fallback common paths
                var user = Environment.UserName;
                var candidates = new[] { $"/run/media/{user}/PS3", $"/media/{user}/PS3", "/mnt/PS3" };
                foreach (var c in candidates) if (Directory.Exists(c)) return c;

                // Try to mount to /mnt/PS3 with sudo
                await RunProcessAsync("bash", "-lc \"sudo mkdir -p /mnt/PS3 && sudo mount " + part + " /mnt/PS3\"", true);
                if (Directory.Exists("/mnt/PS3")) return "/mnt/PS3";

                return null;
            }
            catch (Exception ex)
            {
                Log($"Linux format error: {ex.Message}");
                return null;
            }
        }

        private async Task PopulateDrivesAsync()
        {
            try
            {
                List<DriveItem> items;
                if (OperatingSystem.IsWindows())
                {
                    items = DriveInfo.GetDrives()
                        .Where(d => d.DriveType == DriveType.Removable && d.IsReady)
                        .Select(d => new DriveItem(
                            display: $"{d.Name.TrimEnd('\\')}  [{d.VolumeLabel}]  ({BytesToString(d.TotalSize)})",
                            rootPath: d.RootDirectory.FullName,
                            driveLetter: d.Name.TrimEnd('\\').LastOrDefault()
                        ))
                        .ToList();
                }
                else if (OperatingSystem.IsMacOS())
                {
                    var output = await RunProcessAsync("diskutil", "list external physical", true);
                    items = ParseMacDisks(output);
                }
                else if (OperatingSystem.IsLinux())
                {
                    var output = await RunProcessAsync("lsblk", "-J -o NAME,TYPE,RM,SIZE,MODEL", true);
                    items = ParseLinuxDisks(output);
                }
                else
                {
                    items = new List<DriveItem>();
                }

                if (_driveCombo != null)
                {
                    _driveCombo.Items = items;
                    if (items.Count > 0) _driveCombo.SelectedIndex = 0;
                }
                Log(items.Count == 0 ? "No removable USB drives detected." : "Detected removable USB drives.");
            }
            catch (Exception ex)
            {
                Log($"Drive detection failed: {ex.Message}");
            }
        }

        private async void OnStartClick(object? sender, RoutedEventArgs e)
        {
            if (_driveCombo?.SelectedItem is not DriveItem sel)
            {
                Log("Select a USB device first.");
                return;
            }

            var url = _urlInput?.Text?.Trim();
            if (string.IsNullOrWhiteSpace(url) || !Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
                (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            {
                Log("Paste a valid HTTP/HTTPS link in 'Firmware Source'.");
                return;
            }

            var confirmed = await ConfirmAsync($"WARNING: ALL DATA ON DEVICE '{sel.Display}' WILL BE DESTROYED. Click OK to proceed.");
            if (!confirmed) { Log("Operation canceled by user."); return; }

            if (OperatingSystem.IsWindows())
            {
                var ok = await FormatDriveWindowsAsync(sel);
                if (!ok)
                {
                    Log("Formatting failed. Aborting.");
                    return;
                }
            }
            else if (OperatingSystem.IsMacOS())
            {
                var mount = await FormatDriveMacAsync(sel);
                if (string.IsNullOrEmpty(mount)) { Log("Formatting failed. Aborting."); return; }
                await InstallFromUrlAsync(url!, mount!);
                return;
            }
            else if (OperatingSystem.IsLinux())
            {
                var mount = await FormatDriveLinuxAsync(sel);
                if (string.IsNullOrEmpty(mount)) { Log("Formatting failed. Aborting."); return; }
                await InstallFromUrlAsync(url!, mount!);
                return;
            }

            await InstallFromUrlAsync(url!, sel.RootPath);
        }

        private async Task<bool> ConfirmAsync(string message)
        {
            var dlg = new Window
            {
                Title = "Confirm",
                Width = 440,
                Height = 180,
                WindowStartupLocation = WindowStartupLocation.CenterOwner
            };
            var panel = new StackPanel { Margin = new Thickness(16), Spacing = 12 };
            panel.Children.Add(new TextBlock { Text = message, TextWrapping = Avalonia.Media.TextWrapping.Wrap, Foreground = Avalonia.Media.Brushes.White });
            var btns = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = Avalonia.Layout.HorizontalAlignment.Right, Spacing = 8 };
            var ok = new Button { Content = "OK" };
            var cancel = new Button { Content = "Cancel" };
            bool result = false;
            ok.Click += (_, __) => { result = true; dlg.Close(); };
            cancel.Click += (_, __) => { result = false; dlg.Close(); };
            btns.Children.Add(cancel);
            btns.Children.Add(ok);
            panel.Children.Add(btns);
            dlg.Content = panel;
            await dlg.ShowDialog(this);
            return result;
        }

        private async Task<bool> FormatDriveWindowsAsync(DriveItem item)
        {
            try
            {
                Log($"Formatting {item.Display} to FAT32/MBR...");
                SetProgress(0);

                // Get DiskNumber via PowerShell (requires admin for subsequent diskpart)
                var diskNumOut = await RunProcessAsync(
                    "powershell",
                    $"-NoProfile -ExecutionPolicy Bypass -Command (Get-Partition -DriveLetter '{item.DriveLetter}').DiskNumber",
                    true);
                if (!int.TryParse(diskNumOut.Trim(), out var diskNumber))
                {
                    Log($"Unable to resolve DiskNumber for drive {item.Display}. Output: {diskNumOut}");
                    return false;
                }

                var script = string.Join(Environment.NewLine, new[]
                {
                    $"select disk {diskNumber}",
                    "clean",
                    "convert mbr",
                    "create partition primary",
                    "format fs=fat32 quick label=PS3",
                    $"assign letter={item.DriveLetter}",
                    "exit"
                });

                var tmp = Path.GetTempFileName();
                await File.WriteAllTextAsync(tmp, script);
                var dpOut = await RunProcessAsync("diskpart", $"/s \"{tmp}\"", true);
                try { File.Delete(tmp); } catch { }

                Log(dpOut);
                SetProgress(5);
                return true;
            }
            catch (Exception ex)
            {
                Log($"Format error: {ex.Message}");
                return false;
            }
        }

        private async Task InstallFromUrlAsync(string url, string usbRoot)
        {
            try
            {
                Log("Preparing download...");
                SetProgress(0);

                var destDir = Path.Combine(usbRoot, "PS3", "UPDATE");
                Directory.CreateDirectory(destDir);

                var targetFile = Path.Combine(destDir, "PS3UPDAT.PUP");

                using var response = await _http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead);
                response.EnsureSuccessStatusCode();
                var total = response.Content.Headers.ContentLength ?? -1L;
                await using var src = await response.Content.ReadAsStreamAsync();
                await using var dst = File.Create(targetFile);

                var buffer = new byte[81920];
                long read = 0;
                int n;
                while ((n = await src.ReadAsync(buffer, 0, buffer.Length)) > 0)
                {
                    await dst.WriteAsync(buffer.AsMemory(0, n));
                    read += n;
                    if (total > 0)
                    {
                        var pct = (double)read / total * 100.0;
                        SetProgress(pct);
                        Log($"Downloading {pct:0}%");
                    }
                    else
                    {
                        Log($"Downloading {BytesToString(read)}");
                    }
                }

                SetProgress(100);
                Log("Done. Saved as PS3/UPDATE/PS3UPDAT.PUP");
            }
            catch (Exception ex)
            {
                Log($"Failed: {ex.Message}");
            }
        }

        private static string BytesToString(long byteCount)
        {
            string[] suf = { "B", "KB", "MB", "GB", "TB" };
            if (byteCount == 0) return "0 B";
            var bytes = Math.Abs(byteCount);
            var place = Convert.ToInt32(Math.Floor(Math.Log(bytes, 1024)));
            var num = Math.Round(bytes / Math.Pow(1024, place), 1);
            return $"{Math.Sign(byteCount) * num} {suf[place]}";
        }

        private void Log(string message)
        {
            if (_logText == null) return;
            if (string.IsNullOrEmpty(_logText.Text)) _logText.Text = message;
            else _logText.Text += Environment.NewLine + message;
        }

        private void SetProgress(double value)
        {
            if (_progressBar != null)
            {
                _progressBar.Value = Math.Clamp(value, 0, 100);
            }
        }

        private static async Task<string> RunProcessAsync(string fileName, string args, bool captureOutput)
        {
            var psi = new ProcessStartInfo
            {
                FileName = fileName,
                Arguments = args,
                RedirectStandardOutput = captureOutput,
                RedirectStandardError = captureOutput,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            using var proc = Process.Start(psi)!;
            string output = "";
            if (captureOutput)
            {
                output = await proc.StandardOutput.ReadToEndAsync();
                output += await proc.StandardError.ReadToEndAsync();
            }
            await proc.WaitForExitAsync();
            return output;
        }

        private async Task CheckForUpdatesAsync()
        {
            try
            {
                var mgr = new UpdateManager("UPDATES_URL_PLACEHOLDER");
                var info = await mgr.CheckForUpdatesAsync();
                if (info != null)
                {
                    Log("Updating...");
                    await mgr.DownloadUpdatesAsync(info);
                    mgr.ApplyUpdatesAndRestart(info);
                }
                else
                {
                    Log("Up to date.");
                }
            }
            catch
            {
                // Silent fail; stay non-intrusive
            }
        }
    }

    public record DriveItem(string Display, string RootPath, char DriveLetter)
    {
        public override string ToString() => Display;
    }
}
