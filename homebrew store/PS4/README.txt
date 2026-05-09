Vortex Prime Homebrew Store — PS4 PKG Packaging Folder

This folder is for building the PS4 test PKG with TrueAncestor (or your preferred FPKG tool).

Final on-disk layout expected by this project:

  PKG ROOT (point TrueAncestor here):
  homebrew store/PS4/
    app0/
      eboot.bin            (you provide or use your template)
      Homebrew Store/PS4/
        index.html
        assets/...
        (all site files copied here)
    sce_sys/
      param.sfo            (generated from your tooling)
      icon0.png            (optional; provide your icon)

Key requirements for this PS4 test build:
- Title (PARAM.SFO): "Homebrew Store/PS4"
- Category: HG
- Content ID: Set one you control (example: VP0000-HOMBRW000_00_VPSTOREPS4TEST)
- The site content MUST live under app0/Homebrew Store/PS4/
- The packaged app must open app0/Homebrew Store/PS4/index.html at launch (via your eboot/template).
- Ensure TrueAncestor (or your packer) uses "homebrew store/PS4" as the PKG root so it picks up both app0 and sce_sys.

How to sync site content into the packaging tree:
- Run PowerShell in this folder and execute:
    ./sync-content.ps1
  This mirrors docs/ into app0/Homebrew Store/PS4/ for packaging.
  Then place your eboot at: app0/eboot.bin and your PARAM.SFO at: sce_sys/param.sfo

Notes:
- This folder is NOT served on the website and is only for local PKG builds.
- If you use another packer, keep the same internal structure.
- Replace sce_sys/param.sfo.TEMPLATE.txt with a real param.sfo before building.
