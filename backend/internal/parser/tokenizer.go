// Package parser turns infix expression strings into evaluated results in
// three stages: tokenize (lexical), toRPN (syntactic, shunting-yard), and
// Evaluator (semantic). Arithmetic is delegated to a Registry interface
// defined in this package (Dependency Inversion) — the parser never imports
// concrete operations. It MUST NOT import net/http, encoding/json, or
// anything from internal/api; the dependency direction is strictly
// api → parser → calculator.
package parser

import (
	"fmt"
	"strconv"
	"unicode"
	"unicode/utf8"

	"github.com/MuhammedTBulut/calculator/backend/internal/apperror"
)

type tokenKind int

const (
	tokNumber tokenKind = iota
	tokOperator // one of + - * / ^ % (plus the internal unary marker in RPN)
	tokLParen
	tokRParen
	tokIdent // function name, e.g. sqrt
)

// token is one lexeme with its byte offset in the input, kept through RPN
// conversion so every later error can still point at the source position.
type token struct {
	kind tokenKind
	text string  // lexeme as written (operator symbol, identifier, number)
	val  float64 // parsed value, tokNumber only
	pos  int     // byte offset of the lexeme start
}

// tokenize splits input into tokens. It is purely lexical: it recognizes
// number/operator/parenthesis/identifier shapes and positions but knows
// nothing about grammar (that is toRPN's job).
func tokenize(input string) ([]token, error) {
	var tokens []token
	for i := 0; i < len(input); {
		c := input[i]
		switch {
		case c == ' ' || c == '\t' || c == '\n' || c == '\r':
			i++
		case c >= '0' && c <= '9' || c == '.':
			start := i
			for i < len(input) && (input[i] >= '0' && input[i] <= '9' || input[i] == '.') {
				i++
			}
			text := input[start:i]
			val, err := strconv.ParseFloat(text, 64)
			if err != nil {
				return nil, &apperror.SyntaxError{Position: start, Reason: fmt.Sprintf("invalid number %q", text)}
			}
			tokens = append(tokens, token{kind: tokNumber, text: text, val: val, pos: start})
		case c == '+' || c == '-' || c == '*' || c == '/' || c == '^' || c == '%':
			tokens = append(tokens, token{kind: tokOperator, text: string(c), pos: i})
			i++
		case c == '(':
			tokens = append(tokens, token{kind: tokLParen, text: "(", pos: i})
			i++
		case c == ')':
			tokens = append(tokens, token{kind: tokRParen, text: ")", pos: i})
			i++
		case isLetter(c):
			start := i
			for i < len(input) && isLetter(input[i]) {
				i++
			}
			tokens = append(tokens, token{kind: tokIdent, text: input[start:i], pos: start})
		default:
			// Decode a full rune so multi-byte garbage reads as one character
			// in the message; the reported position stays a byte offset.
			r, _ := utf8.DecodeRuneInString(input[i:])
			reason := fmt.Sprintf("unexpected character %q", r)
			if r == utf8.RuneError {
				reason = "invalid UTF-8 byte"
			} else if unicode.IsSpace(r) {
				// Non-ASCII whitespace (NBSP etc.) is rejected, not skipped:
				// silently accepting it would make lookalike inputs diverge.
				reason = fmt.Sprintf("unsupported whitespace %q", r)
			}
			return nil, &apperror.SyntaxError{Position: i, Reason: reason}
		}
	}
	return tokens, nil
}

func isLetter(c byte) bool {
	return c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z'
}
