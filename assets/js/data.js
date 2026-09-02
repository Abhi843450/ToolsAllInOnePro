/**
 * Data.js — Static reference data for cheatsheets, tables, and lists
 */
const Data = {};

// ─── ASCII TABLE ────────────────────────────────────────────
Data.asciiTable = [];
for (let i = 0; i < 128; i++) {
  Data.asciiTable.push({ dec: i, hex: i.toString(16).toUpperCase().padStart(2,'0'), oct: i.toString(8).padStart(3,'0'), bin: i.toString(2).padStart(8,'0'), char: i >= 32 && i < 127 ? String.fromCharCode(i) : i === 0 ? 'NUL' : i === 7 ? 'BEL' : i === 8 ? 'BS' : i === 9 ? 'TAB' : i === 10 ? 'LF' : i === 13 ? 'CR' : i === 27 ? 'ESC' : i === 127 ? 'DEL' : 'CTRL' });
}

// ─── HTTP STATUS CODES ──────────────────────────────────────
Data.httpStatus = {
  '100': 'Continue', '101': 'Switching Protocols', '102': 'Processing',
  '200': 'OK', '201': 'Created', '202': 'Accepted', '203': 'Non-Authoritative Information', '204': 'No Content', '205': 'Reset Content', '206': 'Partial Content',
  '300': 'Multiple Choices', '301': 'Moved Permanently', '302': 'Found', '303': 'See Other', '304': 'Not Modified', '307': 'Temporary Redirect', '308': 'Permanent Redirect',
  '400': 'Bad Request', '401': 'Unauthorized', '403': 'Forbidden', '404': 'Not Found', '405': 'Method Not Allowed', '406': 'Not Acceptable', '408': 'Request Timeout', '409': 'Conflict', '410': 'Gone', '411': 'Length Required', '413': 'Payload Too Large', '415': 'Unsupported Media Type', '422': 'Unprocessable Entity', '429': 'Too Many Requests',
  '500': 'Internal Server Error', '501': 'Not Implemented', '502': 'Bad Gateway', '503': 'Service Unavailable', '504': 'Gateway Timeout'
};

// ─── HTML ENTITIES ──────────────────────────────────────────
Data.htmlEntities = [
  ['&amp;','&','ampersand'],['&lt;','<','less than'],['&gt;','>','greater than'],['&quot;','"','double quote'],["&apos;",'\'','apostrophe'],
  ['&nbsp;',' ','non-breaking space'],['&copy;','©','copyright'],['&reg;','®','registered'],['&trade;','™','trademark'],
  ['&euro;','€','euro'],['&pound;','£','pound'],['&yen;','¥','yen'],['&cent;','¢','cent'],
  ['&deg;','°','degree'],['&plusmn;','±','plus-minus'],['&micro;','µ','micro'],['&para;','¶','pilcrow'],
  ['&middot;','·','middle dot'],['&hellip;','…','ellipsis'],['&mdash;','—','em dash'],['&ndash;','–','en dash'],
  ['&lsquo;','\u2018','left single quote'],["&rsquo;",'\u2019','right single quote'],['&ldquo;','"','left double quote'],['&rdquo;','"','right double quote'],
  ['&larr;','←','left arrow'],['&rarr;','→','right arrow'],['&uarr;','↑','up arrow'],['&darr;','↓','down arrow'],
  ['&times;','×','multiplication'],['&divide;','÷','division'],['&infin;','∞','infinity'],
  ['&alpha;','α','alpha'],['&beta;','β','beta'],['&gamma;','γ','gamma'],['&delta;','δ','delta'],['&theta;','θ','theta'],['&lambda;','λ','lambda'],['&pi;','π','pi'],['&sigma;','σ','sigma'],['&omega;','ω','omega'],
  ['&hearts;','♥','heart'],['&diams;','◆','diamond'],['&clubs;','♣','club'],['&spades;','♠','spade'],
];

// ─── EMOJI LIST ─────────────────────────────────────────────
Data.emojiList = {
  'Smileys': [['😀','grinning'],['😃','smiley'],['😄','smile'],['😁','grin'],['😆','laughing'],['😅','sweat smile'],['🤣','rofl'],['😂','joy'],['🙂','slightly smile'],['🙃','upside down'],['😉','wink'],['😊','blush'],['😇','innocent'],['🥰','hearts face'],['😍','heart eyes'],['🤩','star struck'],['😘','kissing heart'],['😗','kissing'],['😚','kissing closed eyes'],['😙','kissing smile'],['🥲','smile tear'],['😋','yum'],['😛','stuck out tongue'],['😜','stuck out tongue wink'],['🤪','zany'],['😝','stuck out tongue closed eyes'],['🤑','money mouth'],['🤗','hug'],['🤭','hand over mouth'],['🤫','shushing'],['🤔','thinking'],['🫡','salute']],
  'Gestures': [['👋','wave'],['🤚','raised back hand'],['🖐️','hand five'],['✋','hand'],['🖖','vulcan'],['👌','ok'],['🤌','pinched fingers'],['🤏','pinch'],['✌️','victory'],['🤞','crossed fingers'],['🤟','love you'],['🤘','metal'],['🤙','call me'],['👈','point left'],['👉','point right'],['👆','point up'],['🖕','middle finger'],['👇','point down'],['👍','thumbs up'],['👎','thumbs down'],['✊','fist'],['👊','punch'],['🤛','left fist'],['🤜','right fist'],['👏','clap'],['🙌','raised hands'],['👐','open hands'],['🤲','palms up'],['🤝','handshake'],['🙏','pray']],
  'Objects': [['⌚','watch'],['📱','phone'],['💻','laptop'],['⌨️','keyboard'],['🖥️','desktop'],['🖨️','printer'],['🖱️','mouse'],['💾','floppy'],['💿','cd'],['📀','dvd'],['📷','camera'],['📹','video'],['🎥','movie'],['📺','tv'],['📻','radio'],['🎙️','mic'],['🎚️','slider'],['🎛️','knob'],['⏱️','stopwatch'],['⏰','alarm'],['🔋','battery'],['🔌','plug'],['💡','bulb'],['🔦','flashlight'],['🕯️','candle'],['🗑️','wastebasket'],['🛢️','drum'],['💸','money wings'],['💵','dollar'],['💳','credit card'],['💰','money bag'],['💎','gem'],['⚖️','scale'],['🧰','toolbox'],['🧲','magnet']],
  'Symbols': [['❤️','red heart'],['🧡','orange heart'],['💛','yellow heart'],['💚','green heart'],['💙','blue heart'],['💜','purple heart'],['🖤','black heart'],['🤍','white heart'],['🤎','brown heart'],['💔','broken heart'],['❣️','heart exclamation'],['💕','two hearts'],['💞','revolving hearts'],['💓','heartbeat'],['💗','growing heart'],['✨','sparkles'],['⭐','star'],['🌟','glowing star'],['💫','dizzy'],['🔥','fire'],['💥','boom'],['💧','droplet'],['💨','dash'],['♿','wheelchair'],['⚠️','warning'],['🚫','prohibited'],['⛔','no entry'],['✳️','eight starred'],['❇️','sparkle'],['✅','check'],['❌','cross'],['❓','question'],['❗','exclamation'],['💯','100'],['🔴','red circle'],['🟠','orange circle'],['🟡','yellow circle'],['🟢','green circle'],['🔵','blue circle'],['🟣','purple circle'],['⚫','black circle'],['⚪','white circle']],
  'Flags': [['🏁','checkered'],['🚩','triangular'],['🎌','crossed'],['🏴','black flag'],['🏳️','white flag'],['🏳️‍🌈','rainbow'],['🇺🇸','US'],['🇬🇧','UK'],['🇫🇷','FR'],['🇩🇪','DE'],['🇯🇵','JP'],['🇰🇷','KR'],['🇨🇳','CN'],['🇮🇳','IN'],['🇧🇷','BR'],['🇷🇺','RU'],['🇨🇦','CA'],['🇦🇺','AU']],
};

// ─── CSS FLEXBOX PROPERTIES ─────────────────────────────────
Data.flexboxCheat = {
  'Container Properties': {
    'display': 'flex | inline-flex',
    'flex-direction': 'row | row-reverse | column | column-reverse',
    'flex-wrap': 'nowrap | wrap | wrap-reverse',
    'justify-content': 'flex-start | flex-end | center | space-between | space-around | space-evenly',
    'align-items': 'flex-start | flex-end | center | stretch | baseline',
    'align-content': 'flex-start | flex-end | center | stretch | space-between | space-around',
    'gap': '<length> | <length> <length>',
  },
  'Item Properties': {
    'order': '<integer>',
    'flex-grow': '<number>',
    'flex-shrink': '<number>',
    'flex-basis': 'auto | <length> | <percentage>',
    'flex': '<grow> <shrink> <basis>',
    'align-self': 'auto | flex-start | flex-end | center | stretch | baseline',
  }
};

// ─── CSS GRID PROPERTIES ────────────────────────────────────
Data.gridCheat = {
  'Container Properties': {
    'display': 'grid | inline-grid',
    'grid-template-columns': '<track-size> | repeat() | minmax() | auto',
    'grid-template-rows': '<track-size> | repeat() | minmax() | auto',
    'grid-gap': '<row-gap> <column-gap>',
    'gap': '<row-gap> <column-gap>',
    'justify-items': 'start | end | center | stretch',
    'align-items': 'start | end | center | stretch',
    'justify-content': 'start | end | center | stretch | space-between | space-around | space-evenly',
    'align-content': 'start | end | center | stretch | space-between | space-around | space-evenly',
  },
  'Item Properties': {
    'grid-column': '<start> / <end> | span <number>',
    'grid-row': '<start> / <end> | span <number>',
    'justify-self': 'start | end | center | stretch',
    'align-self': 'start | end | center | stretch',
  }
};

// ─── LINUX COMMANDS ─────────────────────────────────────────
Data.linuxCommands = [
  ['ls', 'List directory contents', 'ls -la'],
  ['cd', 'Change directory', 'cd /path/to/dir'],
  ['pwd', 'Print working directory', 'pwd'],
  ['mkdir', 'Make directory', 'mkdir -p path/to/dir'],
  ['rm', 'Remove files/directories', 'rm -rf dir/'],
  ['cp', 'Copy files', 'cp -r src/ dest/'],
  ['mv', 'Move/rename files', 'mv old.txt new.txt'],
  ['cat', 'Display file contents', 'cat file.txt'],
  ['head', 'Show first lines', 'head -n 10 file.txt'],
  ['tail', 'Show last lines', 'tail -f log.txt'],
  ['grep', 'Search text patterns', 'grep -r "pattern" .'],
  ['find', 'Find files', 'find . -name "*.py"'],
  ['chmod', 'Change permissions', 'chmod 755 script.sh'],
  ['chown', 'Change ownership', 'chown user:group file'],
  ['ps', 'Process status', 'ps aux | grep python'],
  ['kill', 'Kill process', 'kill -9 PID'],
  ['top', 'System monitor', 'top -bn1'],
  ['df', 'Disk free space', 'df -h'],
  ['du', 'Disk usage', 'du -sh dir/'],
  ['free', 'Memory usage', 'free -h'],
  ['curl', 'HTTP requests', 'curl -O url'],
  ['wget', 'Download files', 'wget url'],
  ['tar', 'Archive files', 'tar -xzf file.tar.gz'],
  ['zip/unzip', 'Compress/decompress', 'zip -r archive.zip dir/'],
  ['ssh', 'Remote login', 'ssh user@host'],
  ['scp', 'Secure copy', 'scp file user@host:/path/'],
  ['git', 'Version control', 'git clone url'],
  ['docker', 'Container management', 'docker ps -a'],
  ['systemctl', 'System services', 'systemctl status nginx'],
  ['journalctl', 'System logs', 'journalctl -u service'],
];

// ─── GIT COMMANDS ───────────────────────────────────────────
Data.gitCommands = [
  ['git init', 'Initialize repository'],
  ['git clone <url>', 'Clone repository'],
  ['git add .', 'Stage all changes'],
  ['git commit -m "msg"', 'Commit changes'],
  ['git push', 'Push to remote'],
  ['git pull', 'Pull from remote'],
  ['git status', 'Check status'],
  ['git log', 'View commit history'],
  ['git branch', 'List branches'],
  ['git checkout <branch>', 'Switch branch'],
  ['git merge <branch>', 'Merge branch'],
  ['git stash', 'Stash changes'],
  ['git stash pop', 'Apply stashed changes'],
  ['git diff', 'View changes'],
  ['git reset HEAD~1', 'Undo last commit (keep changes)'],
  ['git reset --hard HEAD~1', 'Undo last commit (discard changes)'],
  ['git revert <commit>', 'Revert specific commit'],
  ['git tag <name>', 'Create tag'],
  ['git remote add origin <url>', 'Add remote'],
  ['git fetch --all', 'Fetch all remotes'],
];

// ─── DOCKER COMMANDS ────────────────────────────────────────
Data.dockerCommands = [
  ['docker build -t name .', 'Build image from Dockerfile'],
  ['docker run -d -p 8080:80 name', 'Run container in background'],
  ['docker ps', 'List running containers'],
  ['docker ps -a', 'List all containers'],
  ['docker images', 'List images'],
  ['docker stop <id>', 'Stop container'],
  ['docker rm <id>', 'Remove container'],
  ['docker rmi <id>', 'Remove image'],
  ['docker exec -it <id> bash', 'Shell into container'],
  ['docker logs <id>', 'View container logs'],
  ['docker-compose up -d', 'Start services'],
  ['docker-compose down', 'Stop services'],
  ['docker volume create <name>', 'Create volume'],
  ['docker network create <name>', 'Create network'],
  ['docker system prune', 'Clean up unused resources'],
];

// ─── SQL CHEAT SHEET ────────────────────────────────────────
Data.sqlCheat = {
  'Queries': [
    ['SELECT * FROM table', 'Select all rows'],
    ['SELECT col1, col2 FROM table', 'Select specific columns'],
    ['WHERE col = \'value\'', 'Filter rows'],
    ['ORDER BY col ASC/DESC', 'Sort results'],
    ['LIMIT 10 OFFSET 5', 'Pagination'],
    ['GROUP BY col', 'Group rows'],
    ['HAVING count(*) > 1', 'Filter groups'],
    ['JOIN table2 ON t1.id = t2.id', 'Join tables'],
    ['LEFT JOIN', 'Include all left rows'],
    ['INNER JOIN', 'Only matching rows'],
  ],
  'Functions': [
    ['COUNT(*)', 'Count rows'],
    ['SUM(col)', 'Sum values'],
    ['AVG(col)', 'Average'],
    ['MIN(col) / MAX(col)', 'Min/Max'],
    ['DISTINCT col', 'Unique values'],
    ['CONCAT(a, b)', 'Concatenate strings'],
    ['NOW()', 'Current timestamp'],
    ['DATE_FORMAT(col, \'%Y-%m\')', 'Format date'],
  ],
  'DDL': [
    ['CREATE TABLE name (col TYPE)', 'Create table'],
    ['ALTER TABLE ADD col TYPE', 'Add column'],
    ['DROP TABLE name', 'Delete table'],
    ['CREATE INDEX idx ON table(col)', 'Create index'],
  ]
};

// ─── PYTHON CHEAT SHEET ─────────────────────────────────────
Data.pythonCheat = {
  'Basics': [
    ['x = 5', 'Variable assignment'],
    ['x, y = 1, 2', 'Multiple assignment'],
    ['f"Hello {x}"', 'f-string formatting'],
    ['type(x)', 'Get type'],
    ['isinstance(x, int)', 'Type check'],
  ],
  'Data Structures': [
    ['list = [1, 2, 3]', 'Create list'],
    ['dict = {"a": 1}', 'Create dictionary'],
    ['tuple = (1, 2, 3)', 'Create tuple'],
    ['set = {1, 2, 3}', 'Create set'],
    ['[x for x in range(10)]', 'List comprehension'],
    ['{k: v for k, v in items}', 'Dict comprehension'],
  ],
  'Functions': [
    ['def func(a, b=5):', 'Function with default'],
    ['lambda x: x * 2', 'Lambda function'],
    ['*args, **kwargs', 'Variable arguments'],
    ['@decorator', 'Decorator'],
  ],
  'File I/O': [
    ['with open("f") as fh:', 'Open file'],
    ['fh.read()', 'Read all'],
    ['fh.readlines()', 'Read as list'],
    ['json.load(fh)', 'Parse JSON'],
    ['json.dump(obj, fh)', 'Write JSON'],
  ],
  'Common': [
    ['len(x)', 'Length'],
    ['sorted(x)', 'Sort'],
    ['enumerate(x)', 'Index + value'],
    ['zip(a, b)', 'Combine iterables'],
    ['map(func, x)', 'Apply function'],
    ['filter(func, x)', 'Filter items'],
    ['any(x) / all(x)', 'Boolean check'],
    ['is / is not', 'Identity check'],
  ]
};

// ─── JAVASCRIPT CHEAT SHEET ─────────────────────────────────
Data.jsCheat = {
  'ES6+ Features': [
    ['const / let', 'Block-scoped variables'],
    ['=> {}', 'Arrow function'],
    ['`Hello ${x}`', 'Template literal'],
    ['...spread', 'Spread/rest operator'],
    ['const {a, b} = obj', 'Destructuring'],
    ['const [a, b] = arr', 'Array destructuring'],
    ['import x from "mod"', 'ES module import'],
    ['export default x', 'ES module export'],
    ['class Foo { }', 'Class syntax'],
    ['async/await', 'Async functions'],
  ],
  'Array Methods': [
    ['arr.map(x => x * 2)', 'Transform each'],
    ['arr.filter(x => x > 0)', 'Filter items'],
    ['arr.reduce((a, b) => a+b, 0)', 'Reduce to single value'],
    ['arr.find(x => x > 5)', 'Find first match'],
    ['arr.findIndex(x => x > 5)', 'Find index'],
    ['arr.some(x => x > 0)', 'Has any match'],
    ['arr.every(x => x > 0)', 'All match'],
    ['arr.flat()', 'Flatten array'],
    ['arr.includes(x)', 'Has value'],
    ['arr.sort((a,b) => a-b)', 'Sort numbers'],
  ],
  'String Methods': [
    ['str.trim()', 'Remove whitespace'],
    ['str.split(",")', 'Split to array'],
    ['arr.join(",")', 'Join to string'],
    ['str.replace(/a/g, "b")', 'Replace (regex)'],
    ['str.includes("sub")', 'Has substring'],
    ['str.startsWith("pre")', 'Starts with'],
    ['str.padStart(5, "0")', 'Pad start'],
    ['str.repeat(3)', 'Repeat string'],
  ],
  'DOM': [
    ['document.querySelector(sel)', 'Select element'],
    ['el.querySelectorAll(sel)', 'Select all'],
    ['el.addEventListener("click", fn)', 'Event listener'],
    ['el.classList.add("cls")', 'Add class'],
    ['el.textContent = "text"', 'Set text'],
    ['el.innerHTML = "<b>hi</b>"', 'Set HTML'],
  ]
};

// ─── REACT CHEAT SHEET ──────────────────────────────────────
Data.reactCheat = {
  'Hooks': [
    ['useState(init)', 'State management'],
    ['useEffect(fn, [deps])', 'Side effects'],
    ['useContext(Ctx)', 'Context consumer'],
    ['useReducer(reducer, init)', 'Complex state'],
    ['useRef(init)', 'Mutable reference'],
    ['useMemo(fn, [deps])', 'Memoized value'],
    ['useCallback(fn, [deps])', 'Memoized callback'],
    ['useImperativeHandle(ref, fn)', 'Custom ref handle'],
    ['useLayoutEffect(fn, [deps])', 'Sync side effects'],
    ['useDebugValue(val)', 'DevTools label'],
  ],
  'Patterns': [
    ['<Comp prop={val} />', 'Props passing'],
    ['{condition && <Comp />}', 'Conditional render'],
    ['{arr.map(i => <C key={i.id} />)}', 'List render'],
    ['<Comp />', 'Function component'],
    ['forwardRef((props, ref) =>)', 'Forward ref'],
    ['createContext(default)', 'Create context'],
    ['useReducer(reducer, init)', 'useReducer pattern'],
  ]
};

// ─── REGEX CHEAT SHEET ──────────────────────────────────────
Data.regexCheat = {
  'Character Classes': [
    ['.', 'Any character (except newline)'],
    ['\\d', 'Digit [0-9]'],
    ['\\D', 'Non-digit'],
    ['\\w', 'Word char [a-zA-Z0-9_]'],
    ['\\W', 'Non-word char'],
    ['\\s', 'Whitespace'],
    ['\\S', 'Non-whitespace'],
    ['[abc]', 'Character set'],
    ['[^abc]', 'Negated set'],
    ['[a-z]', 'Range'],
  ],
  'Quantifiers': [
    ['*', '0 or more'],
    ['+', '1 or more'],
    ['?', '0 or 1'],
    ['{n}', 'Exactly n'],
    ['{n,}', 'n or more'],
    ['{n,m}', 'Between n and m'],
    ['*?', 'Lazy 0+'],
    ['+?', 'Lazy 1+'],
  ],
  'Anchors & Groups': [
    ['^', 'Start of string'],
    ['$', 'End of string'],
    ['\\b', 'Word boundary'],
    ['(abc)', 'Capture group'],
    ['(?:abc)', 'Non-capturing group'],
    ['(?<name>abc)', 'Named group'],
    ['a|b', 'Alternation (or)'],
    ['(?=abc)', 'Positive lookahead'],
    ['(?!abc)', 'Negative lookahead'],
  ]
};

// ─── MARKDOWN CHEAT SHEET ───────────────────────────────────
Data.markdownCheat = {
  'Text': [
    ['# Heading 1', 'H1 heading'],
    ['## Heading 2', 'H2 heading'],
    ['### Heading 3', 'H3 heading'],
    ['**bold**', 'Bold text'],
    ['*italic*', 'Italic text'],
    ['~~strikethrough~~', 'Strikethrough'],
    ['`code`', 'Inline code'],
    ['> blockquote', 'Blockquote'],
    ['---', 'Horizontal rule'],
  ],
  'Lists': [
    ['- item', 'Unordered list'],
    ['1. item', 'Ordered list'],
    ['- [ ] task', 'Task list (unchecked)'],
    ['- [x] task', 'Task list (checked)'],
  ],
  'Links & Images': [
    ['[text](url)', 'Link'],
    ['![alt](image-url)', 'Image'],
    ['[text][ref]\n[ref]: url', 'Reference link'],
  ],
  'Code Blocks': [
    ['```lang\\ncode\\n```', 'Fenced code block'],
    ['    code', 'Indented code block'],
  ],
  'Tables': [
    ['| a | b |', 'Table header'],
    ['|---|---|', 'Table separator'],
    ['| 1 | 2 |', 'Table row'],
  ]
};

// ─── DATE FORMAT REFERENCE ──────────────────────────────────
Data.dateFormats = [
  ['%Y-%m-%d', '2024-01-15', 'ISO date'],
  ['%Y-%m-%dT%H:%M:%S', '2024-01-15T10:30:00', 'ISO datetime'],
  ['%m/%d/%Y', '01/15/2024', 'US date'],
  ['%d/%m/%Y', '15/01/2024', 'EU date'],
  ['%B %d, %Y', 'January 15, 2024', 'Long month'],
  ['%b %d, %Y', 'Jan 15, 2024', 'Short month'],
  ['%Y-%m-%d %H:%M', '2024-01-15 10:30', 'Date + Time'],
  ['%H:%M:%S', '10:30:45', 'Time only'],
  ['%A, %B %d', 'Monday, January 15', 'Day + Month'],
  ['%Y-%j', '2024-015', 'Day of year'],
  ['%W', '03', 'Week number'],
];

// ─── ERROR CODES ────────────────────────────────────────────
Data.errorCodes = {
  'JavaScript': [
    ['ReferenceError', 'Variable not defined'],
    ['TypeError', 'Wrong type used'],
    ['SyntaxError', 'Invalid syntax'],
    ['RangeError', 'Value out of range'],
    ['URIError', 'URI encoding error'],
    ['EvalError', 'eval() error'],
  ],
  'Python': [
    ['SyntaxError', 'Invalid syntax'],
    ['NameError', 'Name not defined'],
    ['TypeError', 'Wrong type'],
    ['ValueError', 'Wrong value'],
    ['IndexError', 'Index out of range'],
    ['KeyError', 'Dict key not found'],
    ['ImportError', 'Module not found'],
    ['AttributeError', 'No such attribute'],
    ['FileNotFoundError', 'File not found'],
    ['ZeroDivisionError', 'Division by zero'],
  ],
  'HTTP': [
    ['400', 'Bad Request'],
    ['401', 'Unauthorized'],
    ['403', 'Forbidden'],
    ['404', 'Not Found'],
    ['500', 'Internal Server Error'],
    ['502', 'Bad Gateway'],
    ['503', 'Service Unavailable'],
  ]
};

// ─── TIMEZONE LIST ──────────────────────────────────────────
Data.timezones = [
  ['UTC-12', 'Baker Island'], ['UTC-11', 'American Samoa'],
  ['UTC-10', 'Hawaii'], ['UTC-9', 'Alaska'],
  ['UTC-8', 'Pacific (US/Canada)'], ['UTC-7', 'Mountain (US/Canada)'],
  ['UTC-6', 'Central (US/Canada)'], ['UTC-5', 'Eastern (US/Canada)'],
  ['UTC-4', 'Atlantic (Canada)'], ['UTC-3', 'Argentina, Brasilia'],
  ['UTC-2', 'Mid-Atlantic'], ['UTC-1', 'Azores'],
  ['UTC+0', 'London, Dublin'], ['UTC+1', 'Paris, Berlin, Rome'],
  ['UTC+2', 'Cairo, Athens'], ['UTC+3', 'Moscow, Istanbul'],
  ['UTC+4', 'Dubai, Baku'], ['UTC+5', 'Karachi, Tashkent'],
  ['UTC+5:30', 'India (IST)'], ['UTC+5:45', 'Nepal'],
  ['UTC+6', 'Dhaka, Almaty'], ['UTC+7', 'Bangkok, Jakarta'],
  ['UTC+8', 'Beijing, Singapore'], ['UTC+9', 'Tokyo, Seoul'],
  ['UTC+9:30', 'Australia (ACST)'], ['UTC+10', 'Sydney, Melbourne'],
  ['UTC+11', 'Solomon Islands'], ['UTC+12', 'Auckland, Fiji'],
];

// ─── MATERIAL DESIGN ICONS (popular subset) ─────────────────
Data.materialIcons = [
  'home','search','settings','person','delete','edit','add','remove','check','close',
  'menu','arrow_back','arrow_forward','arrow_upward','arrow_downward','refresh','sync',
  'download','upload','share','visibility','visibility_off','lock','lock_open','vpn_key',
  'favorite','star','thumb_up','thumb_down','comment','email','phone','location_on',
  'map','directions','traffic','flight','train','bus','hotel','restaurant',
  'shopping_cart','payment','account_balance','savings','trending_up','trending_down',
  'analytics','bar_chart','pie_chart','show_chart','multiline_chart',
  'code','bug_report','build','developer_mode','terminal','storage','cloud',
  'wifi','bluetooth','battery','flash_on','power_settings_new','brightness_high',
  'palette','brush','format_paint','color_lens','crop','rotate_left','rotate_right',
  'zoom_in','zoom_out','fullscreen','aspect_ratio','photo_library','camera_alt',
  'videocam','music_note','queue_music','volume_up','volume_off','play_arrow',
  'pause','stop','skip_next','skip_previous','replay','shuffle','repeat',
  'text_fields','format_bold','format_italic','format_underlined','format_list_bulleted',
  'format_align_left','format_align_center','format_align_right','format_size',
  'attach_file','link','content_copy','content_paste','content_cut',
  'undo','redo','save','print','attach_money','monetization_on',
  'notifications','notifications_active','notifications_off','mark_email_read',
  'calendar_today','event','schedule','alarm','timer','hourglass_empty',
  'today','date_range','access_time','watch_later','update',
  'info','warning','error','check_circle','cancel','help','help_outline',
  'dashboard','apps','widgets','category','expand_more','expand_less',
  'chevron_right','chevron_left','keyboard_arrow_up','keyboard_arrow_down',
  'more_vert','more_horiz','tune','filter_list','sort','swap_vert',
  'qr_code','barcode','tag','label','bookmark','bookmark_border',
  'folder','folder_open','file_copy','description','insert_drive_file',
  'cloud_upload','cloud_download','cloud_done','cloud_off',
  'smart_toy','robot','memory','psychology','science','biotech',
  'local_hospital','healing','fitness_center','monitor_heart','bloodtype',
  'school','menu_book','library_books','auto_stories','emoji_events',
  'sports_esports','cake','celebration','emoji_emotions','mood',
];

// ─── SAFE WEB COLORS ────────────────────────────────────────
Data.safeColors = [
  ['#000000','Black'],['#FFFFFF','White'],['#FF0000','Red'],['#00FF00','Green'],
  ['#0000FF','Blue'],['#FFFF00','Yellow'],['#FF00FF','Magenta'],['#00FFFF','Cyan'],
  ['#808080','Gray'],['#C0C0C0','Silver'],['#800000','Maroon'],['#808000','Olive'],
  ['#008000','Green'],['#800080','Purple'],['#008080','Teal'],['#000080','Navy'],
  ['#FFA500','Orange'],['#FFC0CB','Pink'],['#A52A2A','Brown'],['#DDA0DD','Plum'],
  ['#90EE90','LightGreen'],['#FFB6C1','LightPink'],['#ADD8E6','LightBlue'],
  ['#F0E68C','Khaki'],['#E6E6FA','Lavender'],['#FFFACD','LemonChiffon'],
];

// ─── MATERIAL DESIGN COLORS ─────────────────────────────────
Data.materialColors = [
  { name: 'Red', hex: '#F44336', shades: ['#FFEBEE','#FFCDD2','#EF9A9A','#E57373','#EF5350','#F44336','#E53935','#D32F2F','#C62828','#B71C1C'] },
  { name: 'Pink', hex: '#E91E63', shades: ['#FCE4EC','#F8BBD0','#F48FB1','#F06292','#EC407A','#E91E63','#D81B60','#C2185B','#AD1457','#880E4F'] },
  { name: 'Purple', hex: '#9C27B0', shades: ['#F3E5F5','#E1BEE7','#CE93D8','#BA68C8','#AB47BC','#9C27B0','#8E24AA','#7B1FA2','#6A1B9A','#4A148C'] },
  { name: 'Blue', hex: '#2196F3', shades: ['#E3F2FD','#BBDEFB','#90CAF9','#64B5F6','#42A5F5','#2196F3','#1E88E5','#1976D2','#1565C0','#0D47A1'] },
  { name: 'Green', hex: '#4CAF50', shades: ['#E8F5E9','#C8E6C9','#A5D6A7','#81C784','#66BB6A','#4CAF50','#43A047','#388E3C','#2E7D32','#1B5E20'] },
  { name: 'Orange', hex: '#FF9800', shades: ['#FFF3E0','#FFE0B2','#FFCC80','#FFB74D','#FFA726','#FF9800','#FB8C00','#F57C00','#EF6C00','#E65100'] },
];
