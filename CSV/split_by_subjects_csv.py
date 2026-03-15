import os
import re
import pandas as pd

INPUT_FILE = "clean_output.xlsx"
OUTPUT_FOLDER = "split_by_subject"


def normalize_subject(name):
    name = str(name).upper().strip()

    # buang suffix jenis sekolah
    name = re.sub(r"\b(SK|SJKC|SJKT|SJK|PPKI|SM)\b", "", name)
    name = re.sub(r"\s+", " ", name).strip()

    return name


def safe_filename(text):
    text = str(text).strip()
    text = re.sub(r'[\\/*?:"<>|]+', "_", text)
    text = re.sub(r"\s+", "_", text)
    return text


def get_available_csv_path(path):
    """
    Jika fail sudah wujud dan sedang dibuka/terkunci,
    simpan ke nama baru:
    PENDIDIKAN_MORAL.csv
    PENDIDIKAN_MORAL_1.csv
    PENDIDIKAN_MORAL_2.csv
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


def main():
    df = pd.read_excel(INPUT_FILE)

    # subjek asas tanpa SK / SJKC / SJKT / dll
    df["baseSubject"] = df["subjectName"].apply(normalize_subject)

    os.makedirs(OUTPUT_FOLDER, exist_ok=True)

    grouped = df.groupby("baseSubject", dropna=False)

    count = 0

    for subject, group in grouped:
        subject = safe_filename(subject if subject else "UNKNOWN_SUBJECT")
        path = os.path.join(OUTPUT_FOLDER, f"{subject}.csv")

        try:
            group.drop(columns=["baseSubject"]).to_csv(
                path,
                index=False,
                encoding="utf-8-sig"
            )
            print(f"Saved: {path}")
        except PermissionError:
            alt_path = get_available_csv_path(path)
            group.drop(columns=["baseSubject"]).to_csv(
                alt_path,
                index=False,
                encoding="utf-8-sig"
            )
            print(f"File locked, saved instead: {alt_path}")

        count += 1

    print(f"Done. {count} CSV files created in '{OUTPUT_FOLDER}'")


if __name__ == "__main__":
    main()