import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { normalizeText, levenshtein, tokenSortRatio, namesMatch } from "./index.ts";

Deno.test("normalizeText - basic normalization", () => {
    assertEquals(normalizeText("Hello World"), "hello world");
    assertEquals(normalizeText("  Space  "), "space");
    assertEquals(normalizeText("Special@#$Chars"), "specialchars");
    assertEquals(normalizeText(null), "");
});

Deno.test("levenshtein - distance calculation", () => {
    assertEquals(levenshtein("kitten", "sitting"), 3);
    assertEquals(levenshtein("flaw", "lawn"), 2);
    assertEquals(levenshtein("sunday", "saturday"), 3);
    assertEquals(levenshtein("a", "a"), 0);
    assertEquals(levenshtein("", "abc"), 3);
});

Deno.test("tokenSortRatio - fuzzy matching", () => {
    // exact match regardless of order
    assertEquals(tokenSortRatio("hello world", "world hello"), 100);

    // partial match
    const score = tokenSortRatio("metaphysics", "metaphysical");
    // max len 12, dist 2. score = (1 - 2/12)*100 = (10/12)*100 = 83.33
    assertEquals(Math.floor(score), 83);
});

Deno.test("namesMatch - integration of logic", () => {
    assertEquals(namesMatch("John Doe", "john doe"), true);
    assertEquals(namesMatch("John Doe", "Doe John"), true);
    assertEquals(namesMatch("Anshuman Goel", "anshuman-goel"), true); // normalization handles hyphen/removal first? 
    // Wait, normalizeText in index.ts removes non-a-z chars. "anshuman-goel" becomes "anshumangoel".
    // "Anshuman Goel" becomes "anshuman goel".
    // "anshuman goel" vs "anshumangoel" -> 
    // tokens: ["anshuman", "goel"] vs ["anshumangoel"]
    // levenshtein("anshuman goel", "anshumangoel") -> 1 (the space)
    // maxLen 13. (1 - 1/13)*100 = 92%. Should be > 80.

    // Actually let's verify specific cases from index.ts logic
});
