WORD_TO_NUMBER: dict[str, int] = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
}


def parse_number(word: str) -> int:
    word_lower = word.lower()
    if word_lower in WORD_TO_NUMBER:
        return WORD_TO_NUMBER[word_lower]
    return int(word)
