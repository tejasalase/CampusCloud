CAMPUS CLOUD — FILE CACHE SIMULATOR

A visual, interactive website that simulates how a campus cloud server decides which files to keep in fast memory and which ones to remove when storage gets full.



WHAT PROBLEM DOES THIS SOLVE?

A campus server only has room for a small number of files in its fast cache memory. If it keeps old, unused files, popular study materials get pushed out.

This simulator uses an explainable, automatic replacement rule:
1. Keep popular files: Every time a file is opened (GET) or updated (PUT), its access count goes up. When the cache fills up, the file with the lowest access count is removed (Least Frequently Used — LFU).
2. Break ties fairly: If two or more files have the exact same lowest access count, the file that has sat untouched the longest is removed first (Least Recently Used — LRU).



KEY FEATURES

- Two Ways to Add Files:
  * Manual Entry: Type any Key (file name) and Value (content or metadata) and click PUT or GET.
  * Browse Computer: Pick a real file from your computer—the simulator automatically uses the file's name as the key, stores its size/type, and lets you download it back.
- Live Visual Cache Board: Watch files move between frequency groups (Frequency = 1, Frequency = 2, etc.) in real time, with a red dashed border highlighting the exact file next in line for eviction.
- Step-by-Step Operation & Eviction Log: Every hit, miss, update, and eviction is logged with a clear explanation of why a file was removed.
- On-Demand STATE Report: Click Show STATE Report anytime to view a clean table of all currently cached files and their access counts.
- Built-in Edge-Case Tests: One-click buttons to test Capacity = 0, frequency ties, repeated updates, missed requests, and custom command sequences.



PROJECT FILES

CampusCloud/
├── index.html   (Webpage layout: inputs, file picker, cache board, logs, STATE table)
├── style.css    (Visual styling, colors, cards, and responsive layout)
├── script.js    (O(1) LFU + LRU cache engine and UI logic)
└── README.md    (Project overview and setup guide)



HOW IT WORKS UNDER THE HOOD (FAST O(1) DESIGN)

Instead of scanning through every cached file on each request, script.js uses two JavaScript Map structures paired with Doubly Linked Lists:
- keyToNode (Map): Finds any file instantly by its name in O(1) time.
- freqToList (Map): Groups files by their access count (1, 2, 3...). Inside each group, files sit in a doubly linked list ordered from Most Recently Used (left) to Least Recently Used (right).
- minFreq Tracker: Keeps track of the lowest active frequency so the simulator can jump directly to the eviction candidate in O(1) time.



HOW TO RUN ON LOCALHOST

Option 1: Using VS Code (Recommended)
1. Download or clone this repository and open the CampusCloud folder in VS Code.
2. Install the Live Server extension.
3. Right-click index.html and select Open with Live Server.

Option 2: Using Python (Terminal / Command Prompt)
1. Open a terminal inside the CampusCloud folder.
2. Run:
   python -m http.server 8000
3. Open your browser and go to http://localhost:8000.


QUICK WALKTHROUGH EXAMPLE

Try clicking Illustrative Example in the top bar (or paste this into the Sequence Runner):
Capacity 2; PUT(A,10); PUT(B,20); GET(A); PUT(C,30); STATE

1. PUT(A,10) and PUT(B,20) fill the cache (both have frequency 1, with B newer than A).
2. GET(A) returns 10 and raises A's frequency to 2.
3. PUT(C,30) sees the cache is full, so it evicts B (lowest frequency 1) and inserts C with frequency 1.
4. STATE displays A (freq 2) and C (freq 1).
