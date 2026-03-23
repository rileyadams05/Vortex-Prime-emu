# Vortex Prime Dashboard Background

## Quick Setup Instructions

Your dashboard is now configured to use a custom Vortex Prime background image. Follow these steps to create and install the background:

### Option 1: Use the Web-Based Image Editor (Recommended)

1. **Open the image editor** in your browser:
   - Navigate to: `m:\my project\my-emu\frontend\public\image-editor.html`
   - Or open it directly in your browser

2. **Upload your original image**:
   - Click "Choose File" and select the BUDM4N gorilla image you provided

3. **Adjust the settings** (default values should work well):
   - Text: "VORTEX PRIME"
   - Font Size: 120
   - Vertical Position: 450
   - Text Color: White (#ffffff)
   - Outline Color: Cyan (#00d9ff)
   - Outline Width: 8

4. **Download the modified image**:
   - Click "Download Modified Image"
   - Save it as `vortex-prime-bg.jpg` in this folder (`m:\my project\my-emu\assets\wallpapers\`)

### Option 2: Use Python Script (If you have PIL/Pillow installed)

1. **Save your original image**:
   - Save the BUDM4N image as `budman-original.jpg` in this folder

2. **Run the Python script**:
   ```bash
   python m:\my project\my-emu\scripts\create_vortex_logo.py
   ```

3. **The script will create** `vortex-prime-bg.jpg` automatically

### Option 3: Manual Image Editing

If you prefer to use your own image editor (Photoshop, GIMP, etc.):

1. Open the BUDM4N image in your editor
2. Add text "VORTEX PRIME" with these settings:
   - Font: Bold, sans-serif (Arial recommended)
   - Size: ~120px (adjust based on image size)
   - Color: White
   - Stroke/Outline: Cyan (#00d9ff), 8px width
   - Position: Centered horizontally, about 65% down vertically
3. Save as `vortex-prime-bg.jpg` in this folder

## Verification

Once you've saved the image:

1. The file should be located at: `m:\my project\my-emu\assets\wallpapers\vortex-prime-bg.jpg`
2. Start your development server
3. Navigate to the Dashboard page
4. You should see your custom Vortex Prime background!

## Troubleshooting

**Image not showing?**
- Verify the file is named exactly `vortex-prime-bg.jpg`
- Check that it's in the correct folder: `m:\my project\my-emu\assets\wallpapers\`
- Clear your browser cache and refresh
- Check browser console for any 404 errors

**Image too dark/bright?**
- You can adjust the overlay darkness in `frontend/src/styles/Dashboard.css`
- Look for `.dashboard-background::after` and modify `rgba(0, 0, 0, 0.3)` 
- Change the last value (0.3) to make it lighter (lower) or darker (higher)

**Text positioning issues?**
- Use the web-based image editor to fine-tune the vertical position
- Adjust the "Vertical Position (Y)" slider until it looks right

## Current Configuration

The dashboard CSS has been updated to:
- Use `vortex-prime-bg.jpg` as the background
- Cover the entire dashboard area
- Center the image
- Apply a subtle dark overlay (30% opacity) for better text readability

File path in CSS: `/assets/wallpapers/vortex-prime-bg.jpg`
