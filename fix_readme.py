import re

with open('README.md', 'r') as f:
    lines = f.readlines()

new_lines = []
in_table = False
table_lines = []

def process_table(t_lines):
    # join all lines, remove newlines, then we can reconstruct
    raw = "".join(t_lines)
    # The structure is like:
    # |\n Centralized Model \n|\n NodeCommerce Model \n|\n
    # |\n---\n|\n---\n|\n
    # we can just remove all newlines between | and text
    
    # Actually, simpler: join everything into one line, then split by '|', strip whitespace, and reconstruct.
    # But wait, there are multiple rows. We need to know where rows end.
    # In the provided markdown, a row ends when two '|' are separated by just a newline:
    # `|\n|\n` indicates end of one row and start of next?
    # Let's look at the original text:
    # 88: |
    # 89:  Centralized Model 
    # 90: |
    # 91:  NodeCommerce Model 
    # 92: |
    # 93: |
    # 94: ---
    # 95: |
    # 96: ---
    # 97: |
    
    # A row seems to start with `|` and end with `|`. Then the next row starts with `|`.
    # So `|\n|\n` is actually `|` (end of row 1) and `|` (start of row 2).
    # Let's just join the lines that belong to the table block, then replace `\n` with empty string.
    # Wait, if we replace `\n` with ` `, we get `| Centralized Model | NodeCommerce Model | | --- | --- | | One central warehouse | Thousands of local reseller nodes |`.
    # That is all on one line, which is NOT a valid markdown table!
    pass

