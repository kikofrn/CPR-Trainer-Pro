import os
import re

# Paths
VTT_DIR = r"c:\Users\FranciscoCarrero\Everyday Hero CPR\EHCPR Master Shared Drive - Documents\EHAcademy Private Files\EHA VIDEO VIEWER\CPR Trainer Pro\public\subtitles"
CHAPTERS_PATH = r"c:\Users\FranciscoCarrero\Everyday Hero CPR\EHCPR Master Shared Drive - Documents\EHAcademy Private Files\EHA VIDEO VIEWER\CPR Trainer Pro\src\chapters.ts"

def parse_timestamp(timestamp_str):
    # E.g. "00:00:44.180" -> 44 seconds
    parts = timestamp_str.split(':')
    if len(parts) == 3:
        h, m, s = parts
        s = float(s)
        total_sec = int(h) * 3600 + int(m) * 60 + int(s)
        return total_sec
    return 0

def format_duration(seconds):
    m = seconds // 60
    s = seconds % 60
    return f"{m}:{s:02d}"

def get_vtt_duration(vtt_filename):
    vtt_path = os.path.join(VTT_DIR, vtt_filename)
    if not os.path.exists(vtt_path):
        return None
    
    with open(vtt_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Find all timestamps
    matches = re.findall(r'(\d{2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}\.\d{3})', content)
    if not matches:
        return None
        
    last_match = matches[-1]
    end_timestamp = last_match[1]
    seconds = parse_timestamp(end_timestamp)
    return format_duration(seconds)

def main():
    with open(CHAPTERS_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Regular expression to find chapter definitions
    # E.g., { id: "cpr-1", title: "Introduction", filename: "01_EHAcademy - CPR AED Course Video-Introduction.mp4", duration: "Video Lesson" }
    pattern = r'({[^}]+filename:\s*"([^"]+)"[^}]+duration:\s*"([^"]+)"[^}]+})'
    
    matches = list(re.finditer(pattern, content))
    print(f"Found {len(matches)} chapter entries in chapters.ts")
    
    updated_content = content
    offset = 0
    
    for match in matches:
        full_block = match.group(1)
        filename = match.group(2)
        old_duration = match.group(3)
        
        # Determine VTT filename
        base_name = filename.rsplit('.', 1)[0]
        vtt_filename = f"{base_name}.vtt"
        
        # Special manual handling for any typos if needed
        # Check standard folder
        duration = get_vtt_duration(vtt_filename)
        if not duration:
            # Try searching case insensitively
            for f in os.listdir(VTT_DIR):
                if f.lower() == vtt_filename.lower():
                    duration = get_vtt_duration(f)
                    break
                    
        if duration:
            print(f"File: {filename} -> {duration}")
            # Replace duration inside this block
            new_block = full_block.replace(f'duration: "{old_duration}"', f'duration: "{duration}"')
            
            # Find the position in updated_content
            start_pos = match.start(1) + offset
            end_pos = match.end(1) + offset
            
            updated_content = updated_content[:start_pos] + new_block + updated_content[end_pos:]
            offset += len(new_block) - len(full_block)
        else:
            print(f"Could not find duration for: {filename} (VTT: {vtt_filename})")
            
    with open(CHAPTERS_PATH, 'w', encoding='utf-8') as f:
        f.write(updated_content)
        
    print("chapters.ts successfully updated with durations!")

if __name__ == "__main__":
    main()
