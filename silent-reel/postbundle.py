# Move <title> and the viewport-fit meta to the top so the artifact host finds them in the first 8KB.
import re
s = open("bundle.html").read()
heads = re.findall(r'<title>[^<]*</title>|<meta name=["\']?claude:viewport-fit-sides["\']?[^>]*>', s)
for h in heads:
    s = s.replace(h, "", 1)
s = re.sub(r'(<html[^>]*>)', lambda m: m.group(1) + "".join(heads), s, count=1)
open("bundle.html", "w").write(s)
