# Campus Cloud – Smart File Cache Simulator

1. This project manages files using limited cache memory.
2. GET(key) retrieves an existing file.
3. PUT(key,value) inserts or updates a file.
4. Every successful access increases its frequency.
5. New files are inserted with frequency 1.
6. LFU removes the least frequently used file.
7. LRU breaks ties by removing the least recently used file.
8. Hash Maps and Doubly Linked Lists manage the cache efficiently.
9. STATE displays cached files and their frequencies.
10. The project tests insertion, updates, cache misses and eviction.
