import json
import re
import docx
import os

def parse_docx_blocks_with_explicit_slides(file_path):
    doc = docx.Document(file_path)
    tips = {}
    current_slide_id = None
    current_paragraphs = []
    
    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue
            
        # Look for "Slide X" at the beginning of the paragraph
        # e.g., "Slide 1. Introduction" or "Slide 10: Topic"
        match = re.match(r'^Slide\s+(\d+)', text, re.IGNORECASE)
        
        if match:
            # Save the previous block
            if current_slide_id and current_paragraphs:
                tips[current_slide_id] = current_paragraphs
                
            slide_num = match.group(1)
            current_slide_id = f"slide-{slide_num}"
            current_paragraphs = []
            
            # The heading text might have other info, but we won't include it in the tips array
            # unless the user wants the title there, but usually it's just the header.
            continue
            
        # Extract formatting for the paragraph
        para_text = ""
        for run in para.runs:
            run_text = run.text
            if not run_text.strip():
                para_text += run_text
                continue
            prefix = ""
            suffix = ""
            if run.bold:
                prefix += "**"
                suffix = "**" + suffix
            if run.italic:
                prefix += "*"
                suffix = "*" + suffix
            para_text += f"{prefix}{run_text}{suffix}"
            
        para_text = para_text.replace("****", "")
        
        if para.style.name.startswith('List'):
            current_paragraphs.append(f"- {para_text}")
        else:
            current_paragraphs.append(para_text)
                
    if current_slide_id and current_paragraphs:
        tips[current_slide_id] = current_paragraphs
        
    return tips

base = r"c:\Users\FranciscoCarrero\Everyday Hero CPR\EHCPR Master Shared Drive - Documents\EHAcademy Private Files\EHA VIDEO VIEWER\CPR Trainer Pro\temp_docx_2"
files = {
    "cpr-aed-course": os.path.join(base, "CPR_Course_Slideshow_Instructor_Notes.docx"),
    "first-aid-course": os.path.join(base, "FirstAid_Course_Slideshow_Instructor_Notes.docx"),
    "pediatric-first-aid-course": os.path.join(base, "PediatricFirstAid_Course_Slideshow_Instructor_Notes.docx")
}

final_tips = {}

for course_id, file_path in files.items():
    if not os.path.exists(file_path):
        print(f"Missing file: {file_path}")
        continue
        
    course_tips = parse_docx_blocks_with_explicit_slides(file_path)
    final_tips[course_id] = course_tips

with open("src/instructor-tips.ts", "w", encoding="utf-8") as f:
    f.write("// Auto-generated from instructor notes docx\n")
    f.write("export const INSTRUCTOR_TIPS: Record<string, Record<string, string[]>> = ")
    f.write(json.dumps(final_tips, indent=2))
    f.write(";\n")

print("Generated src/instructor-tips.ts successfully with explicit Slide mapping!")
