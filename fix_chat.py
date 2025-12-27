
import os

file_path = 'c:/job-ecosystem-backend/src/views/chat.ejs'

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Lines are 0-indexed. 
    # Based on view_file, line 132 (index 131) is <li class="chat-day-label">
    # We want to verify this.
    
    start_index = 131
    if start_index < len(lines) and 'chat-day-label' in lines[start_index]:
        print(f"Found start at line {start_index+1}")
        
        # Find the closing </ul>
        end_index = -1
        for i in range(start_index, len(lines)):
            if '</ul>' in lines[i]:
                end_index = i
                break
        
        if end_index != -1:
            print(f"Found end at line {end_index+1}")
            
            # Content to insert
            new_content = """                                    <li class="chat-item-start">
                                        <div class="d-flex justify-content-center align-items-center" style="height: 400px; width: 100%;">
                                            <div class="text-center text-muted">
                                                <i class="ri-chat-smile-2-line fs-1"></i>
                                                <p class="mt-2">Select a conversation to start messaging</p>
                                            </div>
                                        </div>
                                    </li>
"""
            # We want to keep the <ul> (at start_index-1) and </ul> (at end_index)
            # So we replace lines from start_index to end_index (exclusive of end_index, but we want to delete up to end_index-1)
            # Python slice assignment: lines[start_index:end_index] = [new_content]
            
            lines[start_index:end_index] = [new_content]
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.writelines(lines)
            print("Successfully replaced content")
        else:
            print("Could not find closing </ul> tag")
    else:
        print(f"Validation failed at line {start_index+1}. Content: {lines[start_index].strip()}")

except Exception as e:
    print(f"Error: {e}")
