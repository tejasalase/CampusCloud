Campus Cloud – Smart File Cache Simulator
This project manages files using limited cache memory.
GET(key) retrieves an existing file.
PUT(key,value) inserts or updates a file.
Every successful access increases its frequency.
New files are inserted with frequency 1.
LFU removes the least frequently used file.
LRU breaks ties by removing the least recently used file.
Hash Maps and Doubly Linked Lists manage the cache efficiently.
STATE displays cached files and their frequencies.
The project tests insertion, updates, cache misses and eviction.
