import os
import re
import pandas as pd

INPUT_FILE = "input.xlsx"
OUTPUT_FILE = "clean_output.xlsx"

# Support:
# 1.1
# 1.1.1
# 1.1.1.1
# K.5.4
# K.5.4.4
RAW_CODE_RE = r"\b(?:K\.?\s*)?\d+\.\d+(?:\.\d+)?(?:\.\d+)?\b"

ITEM_MARKER_RE = re.compile(
    r"(?:(?<=^)|(?<=\s)|(?<=;))(\([ivxlcdm]+\)|[ivxlcdm]+\)|\([a-z]\)|[a-z]\)|\(\d+\)|\d+\))\s+",
    re.I,
)


def clean_string(value):
    if pd.isna(value):
        return ""
    return str(value).strip()


def normalize_spaces(text):
    text = clean_string(text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def repair_spcode(text):
    text = clean_string(text)
    text = re.sub(r"\b[Kk]\s*\.\s*(?=\d)", "K.", text)
    text = re.sub(r"\b[Kk]\s+(?=\d)", "K.", text)
    text = re.sub(r"(?<=\d)\s*\.\s*(?=\d)", ".", text)
    return text


def normalize_spcode(code):
    code = repair_spcode(code)
    m = re.search(RAW_CODE_RE, code)
    if not m:
        return ""
    code = m.group(0)
    code = re.sub(r"^[Kk]\.?\s*", "", code)
    code = re.sub(r"\s*\.\s*", ".", code)
    return code.strip()


def strip_spcode_from_text(text, spcode):
    text = clean_string(text)
    if not spcode:
        return text

    escaped = re.escape(spcode)
    text = re.sub(rf"^\s*{escaped}\s*", "", text)
    text = re.sub(rf"\s*{escaped}\s*$", "", text)
    return text.strip()


def extract_segments(desc, raw_spcode=""):
    """
    Pecahkan description kepada beberapa segmen jika ada banyak spCode
    dalam satu line, termasuk K.5.4 / K.5.4.4 / 1.1 / 1.1.1 / 1.1.1.1
    """
    desc = repair_spcode(desc)
    raw_spcode = normalize_spcode(raw_spcode)

    code_finder = re.compile(RAW_CODE_RE)
    matches = list(code_finder.finditer(desc))

    segments = []

    if matches:
        # jika ada text sebelum code pertama dan spCode column ada nilai
        if raw_spcode and matches[0].start() > 0:
            prefix_text = desc[:matches[0].start()].strip(" ;")
            if prefix_text:
                segments.append((raw_spcode, prefix_text))

        for i, m in enumerate(matches):
            code = normalize_spcode(m.group(0))
            start = m.end()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(desc)
            seg_text = desc[start:end].strip(" ;")
            if seg_text:
                segments.append((code, seg_text))

        return segments

    if raw_spcode:
        desc = strip_spcode_from_text(desc, raw_spcode)
        if desc:
            return [(raw_spcode, desc)]
        return []

    desc = desc.strip()
    if desc:
        return [(None, desc)]
    return []


def clean_leading_symbol(text):
    text = clean_string(text)
    text = re.sub(r"^\.\s*", "", text)
    return text.strip()


def remove_unwanted_notes(text):
    text = clean_string(text)

    # buang nota Cadangan / Suggestion yang ada bit.ly/modultmkt
    text = re.sub(
        r"\(\*?\s*(?:Cadangan|Suggestion)\s*:.*?bit\.ly/modultmkt\d+\s*\)",
        "",
        text,
        flags=re.I,
    )

    # buang nota Cadangan / Suggestion umum
    text = re.sub(
        r"\(\*?\s*(?:Cadangan|Suggestion)\s*:.*?\)",
        "",
        text,
        flags=re.I,
    )

    # buang sisa "Apply TMK element..." kalau tertinggal
    text = re.sub(
        r"\*?\s*(?:Cadangan|Suggestion)\s*:.*?bit\.ly/modultmkt\d+",
        "",
        text,
        flags=re.I,
    )

    text = normalize_spaces(text)
    text = re.sub(r"\s+([;:,.])", r"\1", text)
    text = re.sub(r"([;:,.])\s*([;:,.])+", r"\1", text)

    return text.strip(" ;")


def remove_list_marker(text):
    text = clean_string(text)
    text = re.sub(
        r"^(?:\([ivxlcdm]+\)|[ivxlcdm]+\)|\([a-z]\)|[a-z]\)|\(\d+\)|\d+\))\s*",
        "",
        text,
        flags=re.I,
    )
    return text.strip(" ;")


def normalize_english_group(spcode):
    if not spcode:
        return None

    first = spcode.split(".")[0]
    mapping = {
        "1": "Listening",
        "2": "Speaking",
        "3": "Reading",
        "4": "Writing",
        "5": "Language Arts",
    }
    return mapping.get(first)


def normalize_bm_group(spcode):
    if not spcode:
        return None

    first = spcode.split(".")[0]
    mapping = {
        "1": "Mendengar Dan Bertutur",
        "2": "Membaca",
        "3": "Menulis",
        "4": "Aspek Seni Bahasa",
        "5": "Aspek Tatabahasa",
    }
    return mapping.get(first)


def normalize_group_name(subject, spcode, group):
    subject_upper = clean_string(subject).upper()
    group = clean_string(group)

    if "BAHASA MELAYU" in subject_upper:
        mapped = normalize_bm_group(spcode)
        if mapped:
            return mapped

    if "ENGLISH" in subject_upper or "BAHASA INGGERIS" in subject_upper:
        mapped = normalize_english_group(spcode)
        if mapped:
            return mapped

    if re.search(r"[A-Za-z]", group):
        return group.title()

    return group


def split_title_and_tail(text):
    text = remove_unwanted_notes(clean_leading_symbol(text))

    if not text:
        return "", ""

    if ";" in text:
        title, tail = text.split(";", 1)
        return title.strip(), tail.strip()

    m = ITEM_MARKER_RE.search(text)
    if m:
        title = text[:m.start()].strip(" ;:")
        tail = text[m.start():].strip()
        return title, tail

    return text.strip(), ""


def extract_items_from_tail(tail):
    tail = normalize_spaces(tail)
    if not tail:
        return []

    matches = list(ITEM_MARKER_RE.finditer(tail))
    if not matches:
        return []

    items = []

    for i, m in enumerate(matches):
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(tail)
        raw_item = tail[start:end].strip(" ;")
        item = remove_list_marker(raw_item)
        item = remove_unwanted_notes(item)
        item = normalize_spaces(item)
        if item:
            items.append(item)

    return items


def split_plain_units(text):
    text = remove_unwanted_notes(normalize_spaces(text))
    if not text:
        return []

    parts = [p.strip() for p in re.split(r"\s*;\s*", text) if p.strip()]
    cleaned = []

    for p in parts:
        p = remove_list_marker(p)
        p = normalize_spaces(p)
        if p:
            cleaned.append(p)

    return cleaned


def dedupe_keep_order(values):
    seen = set()
    output = []

    for v in values:
        key = normalize_spaces(v).casefold()
        if key and key not in seen:
            seen.add(key)
            output.append(normalize_spaces(v))

    return output


def should_skip(group, desc):
    block = f"{group} {desc}".upper()

    if "PKJR" in block:
        return True
    if "NO LEARNING STANDARD" in block:
        return True
    if "LANGUAGE AWARENESS" in block:
        return True
    if "LEARNING AWARENESS" in block:
        return True
    if "PRASEKOLAH" in block:
        return True
    if "PRA SEKOLAH" in block:
        return True
    if "PRESCHOOL" in block:
        return True

    return False


def generate_sort_order(spcode):
    spcode = normalize_spcode(spcode)
    if not spcode:
        return ""

    try:
        parts = [int(p) for p in spcode.split(".")]
        while len(parts) < 4:
            parts.append(0)

        return int("".join(f"{p:02d}" for p in parts[:4]))
    except Exception:
        return ""


def build_description(title, units):
    title = remove_unwanted_notes(normalize_spaces(title))
    units = dedupe_keep_order(units)

    units = [u for u in units if u.casefold() != title.casefold()]

    if title and units:
        return f"{title}; " + "; ".join(units)
    if title:
        return title
    if units:
        return "; ".join(units)
    return ""


def get_available_output_path(path):
    """
    Jika file sedang dibuka / terkunci, simpan ke nama baru.
    Contoh:
    clean_output.xlsx
    clean_output_1.xlsx
    clean_output_2.xlsx
    """
    if not os.path.exists(path):
        return path

    base, ext = os.path.splitext(path)
    counter = 1

    while True:
        new_path = f"{base}_{counter}{ext}"
        if not os.path.exists(new_path):
            return new_path
        counter += 1


def clean_parser(df):
    buffers = {}
    order = []
    current_key = None

    for _, row in df.iterrows():
        subject = clean_string(row.get("subjectName", ""))
        subject_id = clean_string(row.get("subjectId", ""))
        year = row.get("year", "")
        group_raw = clean_string(row.get("groupName", ""))
        desc_raw = clean_string(row.get("spDescription", ""))
        spcode_raw = clean_string(row.get("spCode", ""))

        if not desc_raw and not spcode_raw:
            continue

        if should_skip(group_raw, desc_raw):
            continue

        segments = extract_segments(desc_raw, spcode_raw)

        if not segments and spcode_raw:
            segments = [(normalize_spcode(spcode_raw), "")]

        for spcode, text in segments:
            text = remove_unwanted_notes(clean_leading_symbol(text))

            if spcode:
                spcode = normalize_spcode(spcode)
                group_name = normalize_group_name(subject, spcode, group_raw)
                key = (subject, subject_id, year, group_name, spcode)

                if key not in buffers:
                    buffers[key] = {
                        "subjectName": subject,
                        "subjectId": subject_id,
                        "year": year,
                        "groupName": group_name,
                        "spCode": spcode,
                        "title": "",
                        "units": [],
                    }
                    order.append(key)

                if text:
                    title, tail = split_title_and_tail(text)
                    items = extract_items_from_tail(tail)

                    if title and not buffers[key]["title"]:
                        buffers[key]["title"] = title

                    if items:
                        buffers[key]["units"].extend(items)
                    else:
                        if tail:
                            buffers[key]["units"].extend(split_plain_units(tail))
                        elif title:
                            if not buffers[key]["title"]:
                                buffers[key]["title"] = title
                            elif title.casefold() != buffers[key]["title"].casefold():
                                buffers[key]["units"].extend(split_plain_units(title))
                        else:
                            buffers[key]["units"].extend(split_plain_units(text))

                current_key = key

            else:
                if current_key and text:
                    title, tail = split_title_and_tail(text)
                    items = extract_items_from_tail(tail)

                    if items:
                        buffers[current_key]["units"].extend(items)
                    elif tail:
                        buffers[current_key]["units"].extend(split_plain_units(tail))
                    elif title:
                        if not buffers[current_key]["title"]:
                            buffers[current_key]["title"] = title
                        elif title.casefold() != buffers[current_key]["title"].casefold():
                            buffers[current_key]["units"].extend(split_plain_units(title))

    rows = []

    for key in order:
        rec = buffers[key]
        merged_desc = build_description(rec["title"], rec["units"])
        merged_desc = remove_unwanted_notes(merged_desc)

        rows.append(
            {
                "subjectName": rec["subjectName"],
                "subjectId": rec["subjectId"],
                "year": rec["year"],
                "groupName": rec["groupName"],
                "spCode": rec["spCode"],
                "spDescription": merged_desc,
                "sortOrder": generate_sort_order(rec["spCode"]),
                "isActive": True,
            }
        )

    clean = pd.DataFrame(rows)

    clean = clean[
        [
            "subjectName",
            "subjectId",
            "year",
            "groupName",
            "spCode",
            "spDescription",
            "sortOrder",
            "isActive",
        ]
    ]

    clean = clean.drop_duplicates()

    clean = clean.sort_values(
        by=["subjectName", "year", "sortOrder", "spCode"],
        kind="stable",
    )

    return clean


def main():
    df = pd.read_excel(INPUT_FILE)
    clean_df = clean_parser(df)

    output_path = OUTPUT_FILE
    try:
        clean_df.to_excel(output_path, index=False)
        print(f"Done. Clean file saved: {output_path}")
    except PermissionError:
        output_path = get_available_output_path(OUTPUT_FILE)
        clean_df.to_excel(output_path, index=False)
        print(
            f"Output file asal sedang dibuka. Saved to new file instead: {output_path}"
        )


if __name__ == "__main__":
    main()