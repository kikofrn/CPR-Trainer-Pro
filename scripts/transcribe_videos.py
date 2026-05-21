import os
import sys
import subprocess
import tempfile
import time

# 1. Self-install required packages if they are missing
def install_dependencies():
    packages = ["moviepy", "requests"]
    for pkg in packages:
        try:
            __import__(pkg)
        except ImportError:
            print(f"Installing missing package: {pkg}...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", pkg])

install_dependencies()

import requests
try:
    from moviepy.editor import VideoFileClip
except ImportError:
    try:
        from moviepy import VideoFileClip
    except ImportError:
        from moviepy.video.io.VideoFileClip import VideoFileClip

# 2. Load API key from local .env
def load_api_key():
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if not os.path.exists(env_path):
        print("Error: Local .env file not found. Please make sure the .env file exists in the root directory.")
        sys.exit(1)
        
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("OPENAI_API_KEY="):
                return line.strip().split("OPENAI_API_KEY=")[1]
    
    print("Error: OPENAI_API_KEY not found in .env file.")
    sys.exit(1)

def transcribe_file(video_path, subtitle_path, api_key):
    print(f"\nProcessing: {os.path.basename(video_path)}")
    
    # 3. Create temp file for highly compressed audio track
    temp_dir = tempfile.gettempdir()
    temp_audio_path = os.path.join(temp_dir, f"eh_temp_audio_{os.path.basename(video_path)}.mp3")
    
    video = None
    try:
        # Extract audio track at ultra-low bit rate (32k, mono) to keep file sizes extremely small (< 5MB)
        print("  -> Extracting and compressing audio track...")
        video = VideoFileClip(video_path)
        if not video.audio:
            print(f"  -> Error: Video file has no audio track!")
            return False
            
        video.audio.write_audiofile(
            temp_audio_path,
            bitrate="32k",
            nbytes=2,
            fps=16000, # 16kHz is ideal for Whisper speech recognition
            logger=None # Suppress moviepy verbose output
        )
    except Exception as e:
        print(f"  -> Audio extraction failed: {e}")
        return False
    finally:
        if video:
            video.close()
            
    # 4. Transcribe using OpenAI Whisper API with a robust retry loop
    max_retries = 5
    for attempt in range(max_retries):
        try:
            print(f"  -> Transcribing using OpenAI Whisper API (Attempt {attempt + 1}/{max_retries})...")
            url = "https://api.openai.com/v1/audio/transcriptions"
            headers = {
                "Authorization": f"Bearer {api_key}"
            }
            
            with open(temp_audio_path, "rb") as audio_file:
                files = {
                    "file": (os.path.basename(temp_audio_path), audio_file, "audio/mp3")
                }
                data = {
                    "model": "whisper-1",
                    "response_format": "vtt" # Returns direct WebVTT file text!
                }
                
                response = requests.post(url, headers=headers, files=files, data=data)
                
            if response.status_code == 200:
                # Write VTT contents directly to subtitles folder
                vtt_content = response.text
                os.makedirs(os.path.dirname(subtitle_path), exist_ok=True)
                with open(subtitle_path, "w", encoding="utf-8") as vtt_file:
                    vtt_file.write(vtt_content)
                    
                print(f"  -> Successfully saved subtitles: {os.path.basename(subtitle_path)}")
                return True
            
            # Check for rate limit or temporary quota warnings
            if response.status_code == 429:
                err_text = response.text
                if "rate_limit" in err_text.lower() or "limit" in err_text.lower():
                    print("  -> Throttled by OpenAI (3 RPM Rate Limit reached). Sleeping for 22 seconds before retrying...")
                    time.sleep(22)
                    continue
                elif "insufficient_quota" in err_text.lower():
                    print("  -> OpenAI Quota status updating. Sleeping for 15 seconds before retrying...")
                    time.sleep(15)
                    continue
            
            print(f"  -> Transcription API failed (Status {response.status_code}): {response.text}")
            return False
            
        except Exception as e:
            print(f"  -> API Request failed on attempt {attempt + 1}: {e}")
            if attempt < max_retries - 1:
                time.sleep(5)
                continue
            return False
        finally:
            # Clean up temp audio file on last attempt or success
            if attempt == max_retries - 1 or response.status_code == 200:
                if os.path.exists(temp_audio_path):
                    try:
                        os.remove(temp_audio_path)
                    except Exception:
                        pass

def main():
    root_dir = os.path.dirname(os.path.dirname(__file__))
    public_dir = os.path.join(root_dir, "public")
    subtitles_dir = os.path.join(public_dir, "subtitles")
    
    api_key = load_api_key()
    
    # Scan the public folder for MP4 files
    mp4_files = []
    for f in os.listdir(public_dir):
        if f.lower().endswith(".mp4"):
            mp4_files.append(f)
            
    if not mp4_files:
        print(f"No video files found in the public folder: {public_dir}")
        return

    print(f"Found {len(mp4_files)} video files in the public folder.")
    print("Beginning subtitle generation pipeline...")
    
    success_count = 0
    skipped_count = 0
    
    for filename in sorted(mp4_files):
        video_path = os.path.join(public_dir, filename)
        
        # Subtitle file has the same base name but .vtt extension
        base_name = os.path.splitext(filename)[0]
        subtitle_filename = f"{base_name}.vtt"
        subtitle_path = os.path.join(subtitles_dir, subtitle_filename)
        
        # Check if already transcribed
        if os.path.exists(subtitle_path):
            print(f"Skipping: {filename} (Subtitles already exist)")
            skipped_count += 1
            continue
            
        success = transcribe_file(video_path, subtitle_path, api_key)
        if success:
            success_count += 1
            print("  -> Sleeping for 20 seconds to stay safely under the 3 RPM rate limit...")
            time.sleep(20)
            
    print("\n" + "="*50)
    print("Transcription Pipeline Completed!")
    print(f"  Total Videos Scanned: {len(mp4_files)}")
    print(f"  Successfully Transcribed: {success_count}")
    print(f"  Skipped (Already Existed): {skipped_count}")
    print("="*50)

if __name__ == "__main__":
    main()
