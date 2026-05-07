import yaml
import sys

try:
    with open('F:/PROJECTS/Vortex-Prime-emu/docs/admin/config.yml', 'r') as f:
        yaml.safe_load(f)
    print("YAML is valid")
except yaml.YAMLError as exc:
    print(f"YAML Error: {exc}")
except Exception as e:
    print(f"Error: {e}")
