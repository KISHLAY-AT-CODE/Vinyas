#!/usr/bin/env python3
import os
import sys
import json
import re
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from tkinter.scrolledtext import ScrolledText

# Optional dotenv loader
try:
    from dotenv import load_dotenv
    # Load dotenv using absolute path of the script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(os.path.join(script_dir, ".env"))
except ImportError:
    pass

# Safe imports for dependencies
PYPDF_AVAILABLE = False
try:
    import pypdf
    PYPDF_AVAILABLE = True
except ImportError:
    pass

GEMINI_AVAILABLE = False
try:
    from google import genai
    GEMINI_AVAILABLE = True
except ImportError:
    pass



class TemplateMakerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Vinyas - Syllabus Template Maker & Editor")
        self.root.geometry("1000x750")
        self.root.minsize(1000, 750)
        self.root.configure(bg="#0f172a") # Slate 900
        
        # State variables
        self.templates = {}         # dict: {examName: subjects_list}
        self.active_exam_name = ""
        self.active_subjects = []   # list of subjects: [{"name": str, "chapters": [{"name": str}], "files": [str]}]
        self.selected_subject_index = -1
        
        # Setup modern dark theme styles for Combobox
        self.setup_ttk_styles()
        
        # Build layout UI
        self.build_ui()
        
        # Prefill Gemini API Key if present in environment/dotenv
        env_key = self.load_api_key_from_env()
        self.entry_api_key.insert(0, env_key)
        
        # Scan initial templates from directory
        self.scan_templates_directory()
        self.refresh_templates_combo()
        
        self.log("Vinyas Template Maker GUI Initialized.")
        self.check_dependencies()

    def check_dependencies(self):
        missing = []
        if not PYPDF_AVAILABLE:
            missing.append("pypdf (install: pip install pypdf)")
        if not GEMINI_AVAILABLE:
            missing.append("google-genai (install: pip install google-genai)")
            
        if missing:
            self.log("WARNING: Missing packages for PDF parsing or AI chapter extraction.")
            messagebox.showwarning(
                "Missing Dependencies",
                "The following packages are missing from your Python environment:\n\n" + 
                "\n".join(missing) + 
                "\n\nAI extraction will not work until these packages are installed."
            )

    def load_api_key_from_env(self):
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            # Search rotated keys (e.g. GEMINI_API_KEY_1)
            for key, value in os.environ.items():
                if key.startswith("GEMINI_API_KEY_") and value.strip():
                    api_key = value.strip()
                    break
        return api_key or ""

    def setup_ttk_styles(self):
        style = ttk.Style()
        style.theme_use('clam')
        
        # Dark mode styling for Combobox field
        style.configure("TCombobox", fieldbackground="#020617", background="#1e293b", foreground="#f8fafc", darkcolor="#1e293b", lightcolor="#1e293b", arrowcolor="#f8fafc", relief="flat")
        style.map("TCombobox",
                  fieldbackground=[('readonly', '#020617')],
                  foreground=[('readonly', '#f8fafc')],
                  background=[('readonly', '#1e293b')])

    def build_ui(self):
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        
        # Outer padding frame
        main_container = tk.Frame(self.root, bg="#0f172a")
        main_container.grid(sticky="nsew", padx=15, pady=15)
        main_container.columnconfigure(0, weight=4) # Left Panel (Subjects List)
        main_container.columnconfigure(1, weight=6) # Right Panel (Chapters, PDFs)
        main_container.rowconfigure(0, weight=8)    # Workspace Row
        main_container.rowconfigure(1, weight=2)    # Logs Row
        
        # Left Panel (Base config, Template Dropdown, Subjects)
        left_panel = tk.Frame(main_container, bg="#1e293b", bd=1, relief="flat", padx=10, pady=10)
        left_panel.grid(row=0, column=0, sticky="nsew", padx=(0, 10), pady=(0, 10))
        left_panel.columnconfigure(0, weight=1)
        left_panel.rowconfigure(4, weight=1) # expand subjects listbox frame
        
        # Header Label
        lbl_title = tk.Label(left_panel, text="Vinyas Template Maker", bg="#1e293b", fg="#0d9488", font=("Segoe UI", 13, "bold"))
        lbl_title.grid(row=0, column=0, sticky="w", pady=(0, 10))
        
        # Select Base Template Frame
        sel_frame = tk.LabelFrame(left_panel, text="Load Base Template", bg="#1e293b", fg="#94a3b8", font=("Segoe UI", 9, "bold"), bd=1, padx=8, pady=8)
        sel_frame.grid(row=1, column=0, sticky="ew", pady=(0, 10))
        sel_frame.columnconfigure(0, weight=1)
        
        self.combo_templates = ttk.Combobox(sel_frame, style="TCombobox", state="readonly")
        self.combo_templates.grid(row=0, column=0, sticky="ew", pady=(0, 5))
        
        btn_sel_frame = tk.Frame(sel_frame, bg="#1e293b")
        btn_sel_frame.grid(row=1, column=0, sticky="ew")
        
        self.btn_load_template = tk.Button(btn_sel_frame, text="Load Base Template", command=self.on_load_template, bg="#0d9488", fg="#f8fafc", activebackground="#14b8a6", activeforeground="#f8fafc", relief="flat", font=("Segoe UI", 9, "bold"))
        self.btn_load_template.pack(side="left", padx=(0, 5))
        
        self.btn_new_template = tk.Button(btn_sel_frame, text="Create New", command=self.on_create_new_template, bg="#334155", fg="#f8fafc", activebackground="#475569", activeforeground="#f8fafc", relief="flat", font=("Segoe UI", 9, "bold"))
        self.btn_new_template.pack(side="left")
        
        # Exam Name Frame
        name_frame = tk.Frame(left_panel, bg="#1e293b")
        name_frame.grid(row=2, column=0, sticky="ew", pady=(0, 10))
        name_frame.columnconfigure(0, weight=1)
        
        lbl_exam_name = tk.Label(name_frame, text="Exam Template Name (e.g. JEE Mains):", bg="#1e293b", fg="#f8fafc", font=("Segoe UI", 9, "bold"))
        lbl_exam_name.grid(row=0, column=0, sticky="w", pady=(0, 2))
        
        self.entry_exam_name = tk.Entry(name_frame, bg="#020617", fg="#f8fafc", relief="flat", bd=1, highlightthickness=1, highlightbackground="#334155", highlightcolor="#0d9488", insertbackground="#f8fafc", font=("Segoe UI", 10))
        self.entry_exam_name.grid(row=1, column=0, sticky="ew", ipady=3)
        self.entry_exam_name.bind("<KeyRelease>", self.on_exam_name_change)
        
        # Subjects Section Frame
        sub_frame = tk.Frame(left_panel, bg="#1e293b")
        sub_frame.grid(row=3, column=0, sticky="nsew", pady=(0, 5))
        sub_frame.columnconfigure(0, weight=1)
        sub_frame.rowconfigure(1, weight=1)
        
        lbl_subjects = tk.Label(sub_frame, text="Subjects List:", bg="#1e293b", fg="#f8fafc", font=("Segoe UI", 9, "bold"))
        lbl_subjects.grid(row=0, column=0, sticky="w", pady=(0, 2))
        
        # Subjects Listbox with Scrollbar
        list_container = tk.Frame(sub_frame, bg="#1e293b")
        list_container.grid(row=1, column=0, sticky="nsew")
        list_container.columnconfigure(0, weight=1)
        list_container.rowconfigure(0, weight=1)
        
        self.listbox_subjects = tk.Listbox(list_container, bg="#020617", fg="#f8fafc", selectbackground="#0d9488", selectforeground="#f8fafc", relief="flat", borderwidth=0, font=("Segoe UI", 10))
        self.listbox_subjects.grid(row=0, column=0, sticky="nsew")
        self.listbox_subjects.bind("<<ListboxSelect>>", self.on_subject_select)
        
        sub_scroll = tk.Scrollbar(list_container, orient="vertical", command=self.listbox_subjects.yview)
        sub_scroll.grid(row=0, column=1, sticky="ns")
        self.listbox_subjects.config(yscrollcommand=sub_scroll.set)
        
        # Subjects action buttons
        sub_btn_frame = tk.Frame(sub_frame, bg="#1e293b")
        sub_btn_frame.grid(row=2, column=0, sticky="ew", pady=(5, 0))
        
        self.btn_add_subject = tk.Button(sub_btn_frame, text="Add Subject", command=self.ask_subject_name, bg="#334155", fg="#f8fafc", activebackground="#475569", activeforeground="#f8fafc", relief="flat", font=("Segoe UI", 9, "bold"))
        self.btn_add_subject.pack(side="left", padx=(0, 5))
        
        self.btn_remove_subject = tk.Button(sub_btn_frame, text="Remove", command=self.on_remove_subject, bg="#e11d48", fg="#f8fafc", activebackground="#f43f5e", activeforeground="#f8fafc", relief="flat", font=("Segoe UI", 9, "bold"))
        self.btn_remove_subject.pack(side="left")
        
        # Right Panel (Dynamic to selected subject - manual chapters & PDFs)
        right_panel = tk.Frame(main_container, bg="#1e293b", bd=1, relief="flat", padx=10, pady=10)
        right_panel.grid(row=0, column=1, sticky="nsew", pady=(0, 10))
        right_panel.columnconfigure(0, weight=1)
        right_panel.rowconfigure(1, weight=6) # Chapters frame expands
        right_panel.rowconfigure(2, weight=4) # PDFs frame expands
        
        self.lbl_selected_subject = tk.Label(right_panel, text="No Subject Selected", bg="#1e293b", fg="#0d9488", font=("Segoe UI", 12, "bold"))
        self.lbl_selected_subject.grid(row=0, column=0, sticky="w", pady=(0, 10))
        
        # Chapters Management Frame
        ch_frame = tk.Frame(right_panel, bg="#1e293b")
        ch_frame.grid(row=1, column=0, sticky="nsew", pady=(0, 10))
        ch_frame.columnconfigure(0, weight=1)
        ch_frame.rowconfigure(1, weight=1)
        
        lbl_ch_title = tk.Label(ch_frame, text="Chapters:", bg="#1e293b", fg="#f8fafc", font=("Segoe UI", 9, "bold"))
        lbl_ch_title.grid(row=0, column=0, sticky="w", pady=(0, 2))
        
        ch_list_container = tk.Frame(ch_frame, bg="#1e293b")
        ch_list_container.grid(row=1, column=0, sticky="nsew")
        ch_list_container.columnconfigure(0, weight=1)
        ch_list_container.rowconfigure(0, weight=1)
        
        self.listbox_chapters = tk.Listbox(ch_list_container, bg="#020617", fg="#f8fafc", selectbackground="#334155", selectforeground="#f8fafc", relief="flat", borderwidth=0, font=("Segoe UI", 10))
        self.listbox_chapters.grid(row=0, column=0, sticky="nsew")
        
        ch_scroll = tk.Scrollbar(ch_list_container, orient="vertical", command=self.listbox_chapters.yview)
        ch_scroll.grid(row=0, column=1, sticky="ns")
        self.listbox_chapters.config(yscrollcommand=ch_scroll.set)
        
        # Manual Add/Remove Chapters controls
        ch_add_frame = tk.Frame(ch_frame, bg="#1e293b")
        ch_add_frame.grid(row=2, column=0, sticky="ew", pady=(5, 0))
        ch_add_frame.columnconfigure(0, weight=1)
        
        self.entry_new_chapter = tk.Entry(ch_add_frame, bg="#020617", fg="#f8fafc", relief="flat", bd=1, highlightthickness=1, highlightbackground="#334155", highlightcolor="#0d9488", insertbackground="#f8fafc", font=("Segoe UI", 9))
        self.entry_new_chapter.grid(row=0, column=0, sticky="ew", ipady=2, padx=(0, 5))
        self.entry_new_chapter.bind("<Return>", self.on_add_chapter)
        
        self.btn_add_chapter = tk.Button(ch_add_frame, text="Add Chapter", command=self.on_add_chapter, bg="#334155", fg="#f8fafc", activebackground="#475569", activeforeground="#f8fafc", relief="flat", font=("Segoe UI", 9, "bold"))
        self.btn_add_chapter.grid(row=0, column=1)
        
        self.btn_remove_chapter = tk.Button(ch_add_frame, text="Remove Selected", command=self.on_remove_chapter, bg="#e11d48", fg="#f8fafc", activebackground="#f43f5e", activeforeground="#f8fafc", relief="flat", font=("Segoe UI", 9, "bold"))
        self.btn_remove_chapter.grid(row=0, column=2, padx=(5, 0))
        
        # PDF Attachment Section Frame
        pdf_frame = tk.Frame(right_panel, bg="#1e293b")
        pdf_frame.grid(row=2, column=0, sticky="nsew")
        pdf_frame.columnconfigure(0, weight=1)
        pdf_frame.rowconfigure(1, weight=1)
        
        lbl_pdf_title = tk.Label(pdf_frame, text="Syllabus PDFs for AI Extract:", bg="#1e293b", fg="#f8fafc", font=("Segoe UI", 9, "bold"))
        lbl_pdf_title.grid(row=0, column=0, sticky="w", pady=(0, 2))
        
        pdf_list_container = tk.Frame(pdf_frame, bg="#1e293b")
        pdf_list_container.grid(row=1, column=0, sticky="nsew")
        pdf_list_container.columnconfigure(0, weight=1)
        pdf_list_container.rowconfigure(0, weight=1)
        
        self.listbox_files = tk.Listbox(pdf_list_container, bg="#020617", fg="#f8fafc", selectbackground="#334155", selectforeground="#f8fafc", relief="flat", borderwidth=0, font=("Segoe UI", 9))
        self.listbox_files.grid(row=0, column=0, sticky="nsew")
        
        pdf_scroll = tk.Scrollbar(pdf_list_container, orient="vertical", command=self.listbox_files.yview)
        pdf_scroll.grid(row=0, column=1, sticky="ns")
        self.listbox_files.config(yscrollcommand=pdf_scroll.set)
        
        # PDF PDF Control Buttons
        pdf_btn_frame = tk.Frame(pdf_frame, bg="#1e293b")
        pdf_btn_frame.grid(row=2, column=0, sticky="ew", pady=(5, 0))
        
        self.btn_add_pdf = tk.Button(pdf_btn_frame, text="Attach PDF...", command=self.on_add_pdf, bg="#334155", fg="#f8fafc", activebackground="#475569", activeforeground="#f8fafc", relief="flat", font=("Segoe UI", 9, "bold"))
        self.btn_add_pdf.pack(side="left", padx=(0, 5))
        
        self.btn_remove_pdf = tk.Button(pdf_btn_frame, text="Remove Selected", command=self.on_remove_pdf, bg="#334155", fg="#f8fafc", activebackground="#475569", activeforeground="#f8fafc", relief="flat", font=("Segoe UI", 9, "bold"))
        self.btn_remove_pdf.pack(side="left")
        
        self.btn_ai_extract = tk.Button(pdf_btn_frame, text="AI Extract & Merge", command=self.on_ai_extract, bg="#0d9488", fg="#f8fafc", activebackground="#14b8a6", activeforeground="#f8fafc", relief="flat", font=("Segoe UI", 9, "bold"))
        self.btn_ai_extract.pack(side="right", padx=(5, 0))
        
        self.btn_ai_overwrite = tk.Button(pdf_btn_frame, text="AI Overwrite", command=self.on_ai_overwrite, bg="#e11d48", fg="#f8fafc", activebackground="#f43f5e", activeforeground="#f8fafc", relief="flat", font=("Segoe UI", 9, "bold"))
        self.btn_ai_overwrite.pack(side="right")
        
        # Bottom Console logs & settings panel
        bottom_panel = tk.Frame(main_container, bg="#0f172a")
        bottom_panel.grid(row=1, column=0, columnspan=2, sticky="nsew", pady=(10, 0))
        bottom_panel.columnconfigure(0, weight=7)
        bottom_panel.columnconfigure(1, weight=3)
        bottom_panel.rowconfigure(0, weight=1)
        
        # Logs console scrolledText Frame
        console_frame = tk.LabelFrame(bottom_panel, text="Output Logs", bg="#0f172a", fg="#94a3b8", font=("Segoe UI", 8, "bold"), bd=1)
        console_frame.grid(row=0, column=0, sticky="nsew", padx=(0, 10))
        console_frame.columnconfigure(0, weight=1)
        console_frame.rowconfigure(0, weight=1)
        
        self.log_console = ScrolledText(console_frame, bg="#020617", fg="#f8fafc", relief="flat", borderwidth=0, font=("Consolas", 9), state="disabled")
        self.log_console.grid(row=0, column=0, sticky="nsew", padx=5, pady=5)
        
        # Save Controls Panel
        save_panel = tk.Frame(bottom_panel, bg="#0f172a")
        save_panel.grid(row=0, column=1, sticky="nsew")
        save_panel.columnconfigure(0, weight=1)
        
        # API config sub-frame
        api_frame = tk.Frame(save_panel, bg="#0f172a")
        api_frame.grid(row=0, column=0, sticky="ew", pady=(0, 10))
        api_frame.columnconfigure(0, weight=1)
        
        lbl_api_key = tk.Label(api_frame, text="Gemini API Key Setup:", bg="#0f172a", fg="#94a3b8", font=("Segoe UI", 8, "bold"))
        lbl_api_key.grid(row=0, column=0, sticky="w", pady=(0, 2))
        
        self.entry_api_key = tk.Entry(api_frame, show="*", bg="#020617", fg="#f8fafc", relief="flat", bd=1, highlightthickness=1, highlightbackground="#334155", highlightcolor="#0d9488", insertbackground="#f8fafc", font=("Segoe UI", 9))
        self.entry_api_key.grid(row=1, column=0, sticky="ew", ipady=2)
        
        self.show_api_val = tk.BooleanVar(value=False)
        chk_show_api = tk.Checkbutton(api_frame, text="Show Key", variable=self.show_api_val, command=self.toggle_api_visibility, bg="#0f172a", fg="#94a3b8", selectcolor="#020617", font=("Segoe UI", 8), activebackground="#0f172a", activeforeground="#94a3b8")
        chk_show_api.grid(row=2, column=0, sticky="w", pady=(2, 0))
        
        # Final Save / Overwrite Button
        self.btn_save_template = tk.Button(save_panel, text="Save & Overwrite Template JSON", command=self.on_save_template, bg="#0d9488", fg="#f8fafc", activebackground="#14b8a6", activeforeground="#f8fafc", relief="flat", font=("Segoe UI", 10, "bold"), pady=8)
        self.btn_save_template.grid(row=1, column=0, sticky="ew", ipady=5)
        
        # Initial gray-out
        self.enable_subject_editing(False)

    def toggle_api_visibility(self):
        if self.show_api_val.get():
            self.entry_api_key.config(show="")
        else:
            self.entry_api_key.config(show="*")

    def enable_subject_editing(self, enable):
        state = "normal" if enable else "disabled"
        self.entry_new_chapter.config(state=state)
        self.btn_add_chapter.config(state=state)
        self.btn_remove_chapter.config(state=state)
        self.btn_add_pdf.config(state=state)
        self.btn_remove_pdf.config(state=state)
        self.btn_ai_extract.config(state=state)
        self.btn_ai_overwrite.config(state=state)

    def log(self, message):
        def _write():
            self.log_console.config(state="normal")
            self.log_console.insert(tk.END, f"{message}\n")
            self.log_console.see(tk.END)
            self.log_console.config(state="disabled")
        self.root.after(0, _write)

    def scan_templates_directory(self):
        self.templates = {}
        templates_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")
        if os.path.exists(templates_dir):
            for file in os.listdir(templates_dir):
                if file.endswith(".json"):
                    try:
                        filepath = os.path.join(templates_dir, file)
                        with open(filepath, "r", encoding="utf-8") as f:
                            data = json.load(f)
                            exam_name = data.get("examName")
                            subjects = data.get("subjects")
                            if exam_name and isinstance(subjects, list):
                                mapped_subjects = []
                                for sub in subjects:
                                    mapped_subjects.append({
                                        "name": sub.get("name", ""),
                                        "chapters": [{"name": ch.get("name", "")} for ch in sub.get("chapters", [])],
                                        "files": []
                                    })
                                self.templates[exam_name] = mapped_subjects
                    except Exception as e:
                        self.log(f"Error loading template {file}: {e}")

    def refresh_templates_combo(self):
        options = ["-- Create New Template --"] + sorted(list(self.templates.keys()))
        self.combo_templates['values'] = options
        self.combo_templates.current(0)

    def on_load_template(self):
        selected = self.combo_templates.get()
        if selected == "-- Create New Template --" or not selected:
            self.on_create_new_template()
            return
            
        if self.active_subjects:
            if not messagebox.askyesno("Confirm Load", "Loading this template will replace your current workspace. Unsaved edits will be lost. Proceed?"):
                return
                
        subjects = self.templates.get(selected)
        if subjects:
            self.active_exam_name = selected
            self.entry_exam_name.delete(0, tk.END)
            self.entry_exam_name.insert(0, selected)
            
            # Perform deep copy
            self.active_subjects = []
            for sub in subjects:
                self.active_subjects.append({
                    "name": sub["name"],
                    "chapters": [{"name": ch["name"]} for ch in sub["chapters"]],
                    "files": []
                })
                
            self.selected_subject_index = -1
            self.update_subjects_listbox()
            self.on_subject_select(None)
            self.log(f"Loaded existing template: '{selected}' ({len(self.active_subjects)} subjects).")

    def on_create_new_template(self):
        if self.active_subjects:
            if not messagebox.askyesno("Confirm New", "Clear current template config and start a new blank template?"):
                return
        self.active_exam_name = ""
        self.active_subjects = []
        self.selected_subject_index = -1
        self.entry_exam_name.delete(0, tk.END)
        self.update_subjects_listbox()
        self.on_subject_select(None)
        self.combo_templates.current(0)
        self.log("Workspace cleared. Ready to design new template.")

    def on_exam_name_change(self, event=None):
        self.active_exam_name = self.entry_exam_name.get()

    def ask_subject_name(self):
        dialog = tk.Toplevel(self.root)
        dialog.title("Add Subject")
        dialog.geometry("320x130")
        dialog.configure(bg="#0f172a")
        dialog.transient(self.root)
        dialog.grab_set()
        
        # Center inside parent window
        x = self.root.winfo_x() + (self.root.winfo_width() // 2) - 160
        y = self.root.winfo_y() + (self.root.winfo_height() // 2) - 65
        dialog.geometry(f"+{x}+{y}")
        
        label = tk.Label(dialog, text="Enter Subject Name (e.g. Chemistry):", bg="#0f172a", fg="#f8fafc", font=("Segoe UI", 10, "bold"))
        label.pack(pady=(15, 8))
        
        entry = tk.Entry(dialog, bg="#020617", fg="#f8fafc", relief="flat", bd=1, highlightthickness=1, highlightbackground="#334155", highlightcolor="#0d9488", insertbackground="#f8fafc")
        entry.pack(padx=20, fill="x")
        entry.focus()
        
        def on_ok(event=None):
            name = entry.get().strip()
            if name:
                if any(sub["name"].lower() == name.lower() for sub in self.active_subjects):
                    messagebox.showerror("Error", "Subject already exists!", parent=dialog)
                    return
                self.active_subjects.append({"name": name, "chapters": [], "files": []})
                self.update_subjects_listbox()
                # Auto select the newly added subject
                self.listbox_subjects.selection_clear(0, tk.END)
                self.listbox_subjects.selection_set(tk.END)
                self.on_subject_select(None)
                self.log(f"Added subject '{name}' to template.")
                dialog.destroy()
            
        btn = tk.Button(dialog, text="Add Subject", command=on_ok, bg="#0d9488", fg="#f8fafc", activebackground="#14b8a6", activeforeground="#f8fafc", relief="flat", font=("Segoe UI", 9, "bold"), padx=10, pady=3)
        btn.pack(pady=10)
        
        dialog.bind("<Return>", on_ok)

    def on_remove_subject(self):
        selection = self.listbox_subjects.curselection()
        if not selection:
            messagebox.showerror("Error", "Please select a subject to remove.")
            return
        index = selection[0]
        sub_name = self.active_subjects[index]["name"]
        if messagebox.askyesno("Confirm", f"Are you sure you want to remove the subject '{sub_name}' and all its chapters?"):
            self.active_subjects.pop(index)
            self.selected_subject_index = -1
            self.update_subjects_listbox()
            self.on_subject_select(None)
            self.log(f"Removed subject '{sub_name}'.")

    def on_subject_select(self, event):
        selection = self.listbox_subjects.curselection()
        if selection:
            index = selection[0]
            self.selected_subject_index = index
            subject = self.active_subjects[index]
            
            self.lbl_selected_subject.config(text=f"Active Subject: {subject['name']}")
            self.enable_subject_editing(True)
            self.update_chapters_listbox()
            self.update_files_listbox()
        else:
            self.selected_subject_index = -1
            self.lbl_selected_subject.config(text="No Subject Selected")
            self.enable_subject_editing(False)
            self.listbox_chapters.delete(0, tk.END)
            self.listbox_files.delete(0, tk.END)

    def update_subjects_listbox(self):
        self.listbox_subjects.delete(0, tk.END)
        for sub in self.active_subjects:
            self.listbox_subjects.insert(tk.END, sub["name"])
        if self.selected_subject_index != -1 and self.selected_subject_index < len(self.active_subjects):
            self.listbox_subjects.selection_set(self.selected_subject_index)

    def update_chapters_listbox(self):
        self.listbox_chapters.delete(0, tk.END)
        if self.selected_subject_index != -1:
            subject = self.active_subjects[self.selected_subject_index]
            for ch in subject["chapters"]:
                self.listbox_chapters.insert(tk.END, ch["name"])

    def update_files_listbox(self):
        self.listbox_files.delete(0, tk.END)
        if self.selected_subject_index != -1:
            subject = self.active_subjects[self.selected_subject_index]
            for filepath in subject["files"]:
                self.listbox_files.insert(tk.END, os.path.basename(filepath))

    def on_add_chapter(self, event=None):
        if self.selected_subject_index == -1:
            return
        ch_name = self.entry_new_chapter.get().strip()
        if not ch_name:
            return
        subject = self.active_subjects[self.selected_subject_index]
        if any(ch["name"].lower() == ch_name.lower() for ch in subject["chapters"]):
            messagebox.showerror("Error", "Chapter already exists in this subject.")
            return
        subject["chapters"].append({"name": ch_name})
        self.update_chapters_listbox()
        self.entry_new_chapter.delete(0, tk.END)
        self.log(f"Added chapter '{ch_name}' to '{subject['name']}' manually.")

    def on_remove_chapter(self):
        selection = self.listbox_chapters.curselection()
        if not selection:
            messagebox.showerror("Error", "Please select a chapter to remove.")
            return
        if self.selected_subject_index == -1:
            return
        index = selection[0]
        subject = self.active_subjects[self.selected_subject_index]
        ch_name = subject["chapters"][index]["name"]
        subject["chapters"].pop(index)
        self.update_chapters_listbox()
        self.log(f"Removed chapter '{ch_name}' from '{subject['name']}'.")

    def on_add_pdf(self):
        if self.selected_subject_index == -1:
            return
        subject = self.active_subjects[self.selected_subject_index]
        filepaths = filedialog.askopenfilenames(
            title=f"Attach Syllabus PDFs for {subject['name']}",
            filetypes=[("PDF files", "*.pdf"), ("All files", "*.*")]
        )
        if filepaths:
            added = 0
            for path in filepaths:
                if path not in subject["files"]:
                    subject["files"].append(path)
                    added += 1
            if added > 0:
                self.update_files_listbox()
                self.log(f"Attached {added} PDF file(s) to '{subject['name']}'.")

    def on_remove_pdf(self):
        selection = self.listbox_files.curselection()
        if not selection:
            messagebox.showerror("Error", "Please select a file to remove.")
            return
        if self.selected_subject_index == -1:
            return
        index = selection[0]
        subject = self.active_subjects[self.selected_subject_index]
        removed_path = subject["files"].pop(index)
        self.update_files_listbox()
        self.log(f"Removed file '{os.path.basename(removed_path)}' from '{subject['name']}'.")

    def on_ai_extract(self):
        self.run_ai_extraction(overwrite=False)

    def on_ai_overwrite(self):
        if messagebox.askyesno("Confirm Overwrite", "Are you sure you want to overwrite? This will delete all existing chapters for this subject and replace them with the AI-extracted chapters."):
            self.run_ai_extraction(overwrite=True)

    def run_ai_extraction(self, overwrite):
        if not PYPDF_AVAILABLE or not GEMINI_AVAILABLE:
            messagebox.showerror("Missing Dependencies", "Install pypdf and google-genai packages to use AI extraction.")
            return
            
        if self.selected_subject_index == -1:
            return
        subject = self.active_subjects[self.selected_subject_index]
        pdf_files = subject.get("files", [])
        if not pdf_files:
            messagebox.showerror("Error", "Please attach at least one PDF file first.")
            return
            
        api_key = self.entry_api_key.get().strip()
        if not api_key:
            messagebox.showerror("Error", "Please provide a Gemini API key.")
            return
            
        self.log(f"Starting AI Chapter extraction (overwrite={overwrite}) for '{subject['name']}'...")
        self.btn_ai_extract.config(state="disabled")
        self.btn_ai_overwrite.config(state="disabled")
        
        # Spawn daemon worker thread to prevent GUI lockup
        thread = threading.Thread(target=self.bg_ai_extraction_worker, args=(subject, pdf_files, api_key, overwrite))
        thread.daemon = True
        thread.start()

    def bg_ai_extraction_worker(self, subject, pdf_files, api_key, overwrite):
        try:
            self.log(f"[{subject['name']}] Extracting text from PDF files...")
            raw_text = ""
            for path in pdf_files:
                if not os.path.exists(path):
                    self.log(f"Warning: PDF file not found: {path}")
                    continue
                try:
                    reader = pypdf.PdfReader(path)
                    for idx, page in enumerate(reader.pages):
                        text = page.extract_text()
                        if text:
                            raw_text += text + "\n"
                except Exception as ex:
                    self.log(f"Error reading PDF {os.path.basename(path)}: {ex}")
            
            if not raw_text.strip():
                raise ValueError("No readable text found in the attached PDFs.")
                
            self.log(f"[{subject['name']}] Extracted {len(raw_text)} chars. Calling Gemini API...")
            
            # Explicitly set environment variable so genai client is fully satisfied
            os.environ["GEMINI_API_KEY"] = api_key
            client = genai.Client(api_key=api_key)
            
            prompt = f"""
You are a curriculum mapping expert. Your task is to extract all the chapters for the subject "{subject['name']}" from the raw syllabus text.
Analyze the text and list the distinct chapter titles. Clean up any section headers, page numbers, or exam codes. Keep chapter names concise, descriptive, and accurate.

You MUST return the output strictly as a JSON array of objects, where each object has a single key "name" representing the chapter. No conversational text, no markdowns, no markdown code block wraps (like ```json), just raw valid JSON.

Format:
[
  {{ "name": "Chapter Name 1" }},
  {{ "name": "Chapter Name 2" }}
]

Raw extracted syllabus text:
{raw_text}
"""
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt
            )
            output_text = response.text.strip()
            
            # Clean markdown code block wrappings if present
            if output_text.startswith("```"):
                lines = output_text.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines[-1].startswith("```"):
                    lines = lines[:-1]
                output_text = "\n".join(lines).strip()
                
            chapters_list = json.loads(output_text)
            if not isinstance(chapters_list, list):
                raise ValueError("AI response failed to format as a JSON array list.")
                
            # Schedule callback on GUI main thread
            self.root.after(0, self.on_ai_extraction_success, subject, chapters_list, overwrite)
            
        except Exception as err:
            self.root.after(0, self.on_ai_extraction_failure, subject, str(err))

    def on_ai_extraction_success(self, subject, extracted_chapters, overwrite):
        self.btn_ai_extract.config(state="normal")
        self.btn_ai_overwrite.config(state="normal")
        self.log(f"[{subject['name']}] AI successfully parsed {len(extracted_chapters)} chapters.")
        
        merged_list = [] if overwrite else list(subject["chapters"])
        added = 0
        for item in extracted_chapters:
            name = item.get("name", "").strip()
            if name:
                # Case-insensitive duplicate prevention
                if not any(ch["name"].lower() == name.lower() for ch in merged_list):
                    merged_list.append({"name": name})
                    added += 1
                    
        subject["chapters"] = merged_list
        if overwrite:
            self.log(f"[{subject['name']}] Overwrote syllabus with {added} AI extracted chapters.")
            messagebox.showinfo("Success", f"AI extracted chapters and overwrote '{subject['name']}' syllabus with {added} chapters!")
        else:
            self.log(f"[{subject['name']}] Merged {added} new unique chapters.")
            messagebox.showinfo("Success", f"AI extracted and merged {added} new chapters into '{subject['name']}'!")
        self.update_chapters_listbox()

    def on_ai_extraction_failure(self, subject, error_msg):
        self.btn_ai_extract.config(state="normal")
        self.btn_ai_overwrite.config(state="normal")
        self.log(f"[{subject['name']}] AI Extraction Failed: {error_msg}")
        messagebox.showerror("AI Extraction Failed", f"AI was unable to parse chapters:\n{error_msg}")

    def on_save_template(self):
        if not self.active_exam_name.strip():
            messagebox.showerror("Error", "Please input an Exam Template Name.")
            return
        if not self.active_subjects:
            messagebox.showerror("Error", "Please add at least one subject with chapters.")
            return
            
        # Format filename to snake_case, matching templates.js naming convention
        filename = self.active_exam_name.strip().lower().replace(" ", "_")
        filename = re.sub(r'[^a-z0-9_]', '', filename) + ".json"
        
        templates_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")
        os.makedirs(templates_dir, exist_ok=True)
        filepath = os.path.join(templates_dir, filename)
        
        payload = {
            "examName": self.active_exam_name.strip(),
            "subjects": [
                {
                    "name": sub["name"],
                    "chapters": [{"name": ch["name"]} for ch in sub["chapters"]]
                }
                for sub in self.active_subjects
            ]
        }
        
        try:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2, ensure_ascii=False)
                
            self.log(f"SUCCESS: Saved template to '{filepath}' successfully.")
            messagebox.showinfo("Saved", f"Template for '{self.active_exam_name}' successfully saved/updated at 'templates/{filename}'!")
            
            # Reload template caches to sync dropdown combobox selection
            self.scan_templates_directory()
            self.refresh_templates_combo()
            self.combo_templates.set(self.active_exam_name.strip())
            
        except Exception as e:
            self.log(f"Error saving template json file: {e}")
            messagebox.showerror("Save Failed", f"Could not write file: {e}")


def main():
    root = tk.Tk()
    app = TemplateMakerApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
