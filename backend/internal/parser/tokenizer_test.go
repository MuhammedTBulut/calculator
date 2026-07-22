package parser

import (
	"errors"
	"testing"

	"github.com/MuhammedTBulut/calculator/backend/internal/apperror"
)

func TestTokenize(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  []token
	}{
		{name: "integer", input: "42",
			want: []token{{kind: tokNumber, text: "42", val: 42, pos: 0}}},
		{name: "decimal", input: "3.14",
			want: []token{{kind: tokNumber, text: "3.14", val: 3.14, pos: 0}}},
		{name: "leading dot decimal", input: ".5",
			want: []token{{kind: tokNumber, text: ".5", val: 0.5, pos: 0}}},
		{name: "all operators", input: "+-*/^%",
			want: []token{
				{kind: tokOperator, text: "+", pos: 0},
				{kind: tokOperator, text: "-", pos: 1},
				{kind: tokOperator, text: "*", pos: 2},
				{kind: tokOperator, text: "/", pos: 3},
				{kind: tokOperator, text: "^", pos: 4},
				{kind: tokOperator, text: "%", pos: 5},
			}},
		{name: "parens and identifier", input: "sqrt(9)",
			want: []token{
				{kind: tokIdent, text: "sqrt", pos: 0},
				{kind: tokLParen, text: "(", pos: 4},
				{kind: tokNumber, text: "9", val: 9, pos: 5},
				{kind: tokRParen, text: ")", pos: 6},
			}},
		{name: "whitespace skipped, positions preserved", input: " 1 +\t2 ",
			want: []token{
				{kind: tokNumber, text: "1", val: 1, pos: 1},
				{kind: tokOperator, text: "+", pos: 3},
				{kind: tokNumber, text: "2", val: 2, pos: 5},
			}},
		{name: "empty input yields no tokens", input: "", want: nil},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := tokenize(tc.input)
			if err != nil {
				t.Fatalf("tokenize(%q) unexpected error: %v", tc.input, err)
			}
			if len(got) != len(tc.want) {
				t.Fatalf("tokenize(%q) = %v, want %v", tc.input, got, tc.want)
			}
			for i := range tc.want {
				if got[i] != tc.want[i] {
					t.Fatalf("tokenize(%q)[%d] = %+v, want %+v", tc.input, i, got[i], tc.want[i])
				}
			}
		})
	}
}

func TestTokenizeErrors(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantPos int
	}{
		// The second dot itself is the offense, not the token start.
		{name: "double-dot number", input: "1.2.3", wantPos: 3},
		{name: "adjacent double dots", input: "12..3", wantPos: 3},
		{name: "lone dot", input: "2+.", wantPos: 2},
		{name: "unexpected ascii character", input: "2$3", wantPos: 1},
		{name: "genuine replacement character", input: "2�3", wantPos: 1},
		{name: "invalid utf-8 byte", input: "2\x803", wantPos: 1},
		{name: "unexpected unicode character", input: "2×3", wantPos: 1}, // × sign
		{name: "non-breaking space rejected", input: "1 +2", wantPos: 1},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := tokenize(tc.input)
			var synErr *apperror.SyntaxError
			if !errors.As(err, &synErr) {
				t.Fatalf("tokenize(%q) error = %v, want *apperror.SyntaxError", tc.input, err)
			}
			if !errors.Is(err, apperror.ErrSyntax) {
				t.Fatalf("tokenize(%q) error does not wrap ErrSyntax", tc.input)
			}
			if synErr.Position != tc.wantPos {
				t.Fatalf("tokenize(%q) position = %d, want %d", tc.input, synErr.Position, tc.wantPos)
			}
		})
	}
}
