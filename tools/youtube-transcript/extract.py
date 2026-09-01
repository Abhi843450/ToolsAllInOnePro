#!/usr/bin/env python3
"""
YouTube Transcript — extract.py
Supports language selection and returns available translation languages.
Usage: python extract.py <url> [lang_code]
"""
import sys
import json
import re
import subprocess
import shutil
import os
import hashlib
import time
import urllib.request
import urllib.parse

CACHE_DIR = os.path.join(os.environ.get('TEMP', '/tmp'), 'toolcache')
CACHE_TTL = 3600

# ISO 639-1 language code to full name mapping
LANG_NAMES = {
    'aa': 'Afar', 'ab': 'Abkhaz', 'af': 'Afrikaans', 'ak': 'Akan', 'am': 'Amharic',
    'ar': 'Arabic', 'as': 'Assamese', 'av': 'Avaric', 'ay': 'Aymara', 'az': 'Azerbaijani',
    'ba': 'Bashkir', 'be': 'Belarusian', 'bg': 'Bulgarian', 'bh': 'Bihari', 'bi': 'Bislama',
    'bm': 'Bambara', 'bn': 'Bengali', 'bo': 'Tibetan', 'br': 'Breton', 'bs': 'Bosnian',
    'ca': 'Catalan', 'ce': 'Chechen', 'ch': 'Chamorro', 'co': 'Corsican', 'cr': 'Cree',
    'cs': 'Czech', 'cu': 'Old Church Slavonic', 'cv': 'Chuvash', 'cy': 'Welsh',
    'da': 'Danish', 'de': 'German', 'dv': 'Divehi', 'dz': 'Dzongkha', 'ee': 'Ewe',
    'el': 'Greek', 'en': 'English', 'eo': 'Esperanto', 'es': 'Spanish', 'et': 'Estonian',
    'eu': 'Basque', 'fa': 'Persian', 'ff': 'Fulah', 'fi': 'Finnish', 'fj': 'Fijian',
    'fo': 'Faroese', 'fr': 'French', 'fy': 'Western Frisian', 'ga': 'Irish', 'gd': 'Scottish Gaelic',
    'gl': 'Galician', 'gn': 'Guarani', 'gu': 'Gujarati', 'gv': 'Manx', 'ha': 'Hausa',
    'he': 'Hebrew', 'hi': 'Hindi', 'ho': 'Hiri Motu', 'hr': 'Croatian', 'ht': 'Haitian',
    'hu': 'Hungarian', 'hy': 'Armenian', 'hz': 'Herero', 'ia': 'Interlingua', 'id': 'Indonesian',
    'ie': 'Interlingue', 'ig': 'Igbo', 'ik': 'Inupiaq', 'io': 'Ido', 'is': 'Icelandic',
    'it': 'Italian', 'iu': 'Inuktitut', 'ja': 'Japanese', 'jv': 'Javanese', 'ka': 'Georgian',
    'kg': 'Kongo', 'ki': 'Kikuyu', 'kj': 'Kwanyama', 'kk': 'Kazakh', 'kl': 'Kalaallisut',
    'km': 'Khmer', 'kn': 'Kannada', 'ko': 'Korean', 'kr': 'Kanuri', 'ks': 'Kashmiri',
    'ku': 'Kurdish', 'kv': 'Komi', 'kw': 'Cornish', 'ky': 'Kyrgyz', 'la': 'Latin',
    'lb': 'Luxembourgish', 'lg': 'Ganda', 'li': 'Limburgish', 'ln': 'Lingala', 'lo': 'Lao',
    'lt': 'Lithuanian', 'lu': 'Luba-Katanga', 'lv': 'Latvian', 'mg': 'Malagasy', 'mh': 'Marshallese',
    'mi': 'Maori', 'mk': 'Macedonian', 'ml': 'Malayalam', 'mn': 'Mongolian', 'mr': 'Marathi',
    'ms': 'Malay', 'mt': 'Maltese', 'my': 'Burmese', 'na': 'Nauru', 'nb': 'Norwegian Bokmål',
    'nd': 'North Ndebele', 'ne': 'Nepali', 'ng': 'Ndonga', 'nl': 'Dutch', 'nn': 'Norwegian Nynorsk',
    'no': 'Norwegian', 'nr': 'South Ndebele', 'nv': 'Navajo', 'ny': 'Chichewa', 'oc': 'Occitan',
    'oj': 'Ojibwe', 'om': 'Oromo', 'or': 'Oriya', 'os': 'Ossetian', 'pa': 'Punjabi',
    'pi': 'Pali', 'pl': 'Polish', 'ps': 'Pashto', 'pt': 'Portuguese', 'qu': 'Quechua',
    'rm': 'Romansh', 'rn': 'Kirundi', 'ro': 'Romanian', 'ru': 'Russian', 'rw': 'Kinyarwanda',
    'sa': 'Sanskrit', 'sc': 'Sardinian', 'sd': 'Sindhi', 'se': 'Northern Sami', 'sg': 'Sango',
    'si': 'Sinhala', 'sk': 'Slovak', 'sl': 'Slovenian', 'sm': 'Samoan', 'sn': 'Shona',
    'so': 'Somali', 'sq': 'Albanian', 'sr': 'Serbian', 'ss': 'Swati', 'st': 'Southern Sotho',
    'su': 'Sundanese', 'sv': 'Swedish', 'sw': 'Swahili', 'ta': 'Tamil', 'te': 'Telugu',
    'tg': 'Tajik', 'th': 'Thai', 'ti': 'Tigrinya', 'tk': 'Turkmen', 'tl': 'Tagalog',
    'tn': 'Tswana', 'to': 'Tongan', 'tr': 'Turkish', 'ts': 'Tsonga', 'tt': 'Tatar',
    'tw': 'Twi', 'ty': 'Tahitian', 'ug': 'Uyghur', 'uk': 'Ukrainian', 'ur': 'Urdu',
    'uz': 'Uzbek', 've': 'Venda', 'vi': 'Vietnamese', 'vo': 'Volapük', 'wa': 'Walloon',
    'wo': 'Wolof', 'xh': 'Xhosa', 'yi': 'Yiddish', 'yo': 'Yoruba', 'za': 'Zhuang',
    'zh': 'Chinese', 'zh-Hant': 'Chinese (Traditional)', 'zh-Hans': 'Chinese (Simplified)',
    'zu': 'Zulu',
}


def get_cache(url):
    key = hashlib.md5(url.encode()).hexdigest()
    path = os.path.join(CACHE_DIR, f'yt_tr_{key}.json')
    if os.path.exists(path):
        age = time.time() - os.path.getmtime(path)
        if age < CACHE_TTL:
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass
    return None


def set_cache(url, data):
    os.makedirs(CACHE_DIR, exist_ok=True)
    key = hashlib.md5(url.encode()).hexdigest()
    path = os.path.join(CACHE_DIR, f'yt_tr_{key}.json')
    try:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f)
    except Exception:
        pass


def extract_video_id(url):
    patterns = [
        r'(?:youtube\.com/watch\?v=)([a-zA-Z0-9_-]{11})',
        r'(?:youtu\.be/)([a-zA-Z0-9_-]{11})',
        r'(?:youtube\.com/shorts/)([a-zA-Z0-9_-]{11})',
        r'(?:youtube\.com/embed/)([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def filter_transcript(transcript):
    noise_re = re.compile(
        r'^(\[Music\]|\[Applause\]|\[Laughter\]|\[Noise\]|\[CHEERING\]|\[MUSIQUE\]|\[♪\]|\[♫\]|\[music\]|\[ applause \]|\[noise \])$',
        re.IGNORECASE
    )
    filtered = []
    for entry in transcript:
        text = entry['text'].strip()
        if not text or noise_re.match(text):
            continue
        if len(text) <= 2 and not text.isalnum():
            continue
        filtered.append(entry)
    return filtered


def get_transcript_with_api(video_id, lang='en'):
    """Use youtube_transcript_api to get transcript with language support."""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        ytt = YouTubeTranscriptApi()
        tl = ytt.list(video_id)

        # Get available languages
        available_langs = []
        for t in tl:
            available_langs.append({
                'code': t.language_code,
                'name': t.language,
                'is_generated': t.is_generated,
                'is_translatable': t.is_translatable,
            })

        # Get translation languages from the first translatable transcript
        translation_langs = []
        for t in tl:
            if t.is_translatable:
                try:
                    for tl_item in t.translation_languages:
                        name = tl_item.language
                        code = tl_item.language_code
                        # Use our LANG_NAMES map for consistency
                        full_name = LANG_NAMES.get(code, name)
                        translation_langs.append({'code': code, 'name': full_name})
                    break
                except Exception:
                    pass

        # Find the best transcript in requested language
        transcript_obj = None
        try:
            transcript_obj = tl.find_transcript([lang])
        except Exception:
            # Fallback: try English, then any available
            try:
                transcript_obj = tl.find_transcript(['en'])
            except Exception:
                if tl:
                    transcript_obj = tl[0]

        if not transcript_obj:
            return [], available_langs, translation_langs, ''

        # Fetch the transcript
        result = transcript_obj.fetch()
        transcript = []
        for s in result.snippets:
            text = s.text.strip()
            if text and text != '\n' and len(text) > 1:
                transcript.append({'start': s.start, 'text': text})

        source_lang = transcript_obj.language_code
        return transcript, available_langs, translation_langs, source_lang

    except ImportError:
        return [], [], [], ''
    except Exception:
        return [], [], [], ''


def get_oembed_info(url):
    oembed_url = f'https://www.youtube.com/oembed?url={urllib.parse.quote(url)}&format=json'
    try:
        req = urllib.request.Request(oembed_url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
            return {'title': data.get('title', ''), 'channel': data.get('author_name', '')}
    except Exception:
        return {'title': '', 'channel': ''}


def main():
    if len(sys.argv) < 2:
        print(json.dumps({'success': False, 'error': 'No URL provided'}))
        sys.exit(1)

    url = sys.argv[1]
    lang = sys.argv[2] if len(sys.argv) > 2 else 'en'
    video_id = extract_video_id(url)

    if not video_id:
        print(json.dumps({'success': False, 'error': 'Invalid YouTube URL'}))
        sys.exit(1)

    thumbnail = f'https://img.youtube.com/vi/{video_id}/hqdefault.jpg'
    title = ''
    channel = ''
    transcript = []
    available_langs = []
    translation_langs = []
    source_lang = ''

    # Use youtube_transcript_api (primary method)
    transcript, available_langs, translation_langs, source_lang = get_transcript_with_api(video_id, lang)

    # Get title from oEmbed
    oembed = get_oembed_info(url)
    title = oembed.get('title', '') or 'YouTube Video'
    channel = oembed.get('channel', '')

    # Filter noise
    if transcript:
        transcript = filter_transcript(transcript)

    note = ''
    if not transcript:
        note = 'No transcript available for this video.'

    result = {
        'success': True,
        'data': {
            'title': title,
            'channel': channel,
            'video_id': video_id,
            'thumbnail': thumbnail,
            'transcript': transcript,
            'url': url,
            'source_lang': source_lang,
            'available_langs': available_langs,
            'translation_langs': translation_langs,
            'note': note if note else None,
        }
    }

    # Don't cache translation requests
    if lang == 'en':
        set_cache(url, result)

    print(json.dumps(result))


if __name__ == '__main__':
    main()
