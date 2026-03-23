from PIL import Image, ImageDraw, ImageFont
import os

def create_vortex_prime_logo(input_image_path, output_image_path):
    """
    Creates a Vortex Prime logo by overlaying text on the original image.
    The text will replace BUDM4N with VORTEX PRIME.
    """
    try:
        img = Image.open(input_image_path)
        
        draw = ImageDraw.Draw(img)
        
        width, height = img.size
        
        try:
            font_size = int(height * 0.15)
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            try:
                font = ImageFont.truetype("Arial.ttf", font_size)
            except:
                font = ImageFont.load_default()
        
        text = "VORTEX PRIME"
        
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        x = (width - text_width) // 2
        y = int(height * 0.65)
        
        outline_color = "#00d9ff"
        text_color = "#ffffff"
        outline_width = 8
        
        for adj_x in range(-outline_width, outline_width + 1):
            for adj_y in range(-outline_width, outline_width + 1):
                if adj_x*adj_x + adj_y*adj_y <= outline_width*outline_width:
                    draw.text((x + adj_x, y + adj_y), text, font=font, fill=outline_color)
        
        draw.text((x, y), text, font=font, fill=text_color)
        
        img.save(output_image_path, quality=95)
        print(f"Successfully created Vortex Prime logo at: {output_image_path}")
        return True
        
    except Exception as e:
        print(f"Error creating logo: {e}")
        return False

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    input_path = os.path.join(project_root, "assets", "wallpapers", "budman-original.jpg")
    output_path = os.path.join(project_root, "assets", "wallpapers", "vortex-prime-bg.jpg")
    
    print("Vortex Prime Logo Creator")
    print("=" * 50)
    print(f"Input: {input_path}")
    print(f"Output: {output_path}")
    print()
    
    if not os.path.exists(input_path):
        print(f"Error: Input image not found at {input_path}")
        print("Please save your original image as 'budman-original.jpg' in the assets/wallpapers folder")
    else:
        create_vortex_prime_logo(input_path, output_path)
