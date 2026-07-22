package parser

import (
	"fmt"

	"github.com/MuhammedTBulut/calculator/backend/internal/apperror"
)

// unaryMinus is the internal RPN marker for prefix negation. It can never
// clash with input because the tokenizer only ever emits single-character
// operator lexemes.
const unaryMinus = "neg"

// precedence and associativity of stack-managed operators. The postfix % is
// absent on purpose: it binds tightest and is emitted straight to the output.
var (
	precedence = map[string]int{
		"+": 1, "-": 1,
		"*": 2, "/": 2,
		unaryMinus: 3,
		"^":        4,
	}
	rightAssociative = map[string]bool{
		"^": true,
		// Prefix operators are necessarily right-associative: -(-3) nests.
		unaryMinus: true,
	}
)

// toRPN converts infix tokens to reverse Polish notation with the
// shunting-yard algorithm — Dijkstra, MR 34/61 (1961) — extended with a
// two-state expectation machine (operand/operator) so every malformed input
// fails here with a position, before evaluation.
//
// Grammar notes, chosen and enforced deliberately:
//   - '-' is unary where an operand is expected, so "2*-3" and "2--3" parse;
//     unary minus binds looser than '^' (-3^2 == -(3^2), standard convention)
//     and tighter than '*' and '/'.
//   - '%' is postfix and binds tightest: "50%+10" is (50%)+10, "2^50%" is 2^(0.5).
//   - Function names must be directly followed by '(' — no implicit
//     multiplication exists, so "2(3)" and "sqrt 4" are syntax errors.
//
// inputLen is used as the position of unexpected-end errors.
func toRPN(tokens []token, inputLen int) ([]token, error) {
	var output, stack []token

	// expectOperand flips as the machine alternates between "an operand may
	// start here" and "an operator may follow here".
	expectOperand := true
	// afterFunc is set between a function identifier and its required '('.
	afterFunc := false

	for _, t := range tokens {
		if afterFunc && t.kind != tokLParen {
			return nil, &apperror.SyntaxError{Position: t.pos, Reason: "expected '(' after function name"}
		}
		switch t.kind {
		case tokNumber:
			if !expectOperand {
				return nil, &apperror.SyntaxError{Position: t.pos, Reason: fmt.Sprintf("unexpected number %q", t.text)}
			}
			output = append(output, t)
			expectOperand = false

		case tokIdent:
			if !expectOperand {
				return nil, &apperror.SyntaxError{Position: t.pos, Reason: fmt.Sprintf("unexpected identifier %q", t.text)}
			}
			stack = append(stack, t)
			afterFunc = true

		case tokLParen:
			if !expectOperand && !afterFunc {
				return nil, &apperror.SyntaxError{Position: t.pos, Reason: "unexpected '('"}
			}
			stack = append(stack, t)
			afterFunc = false
			expectOperand = true

		case tokRParen:
			if expectOperand {
				return nil, &apperror.SyntaxError{Position: t.pos, Reason: "unexpected ')'"}
			}
			for {
				if len(stack) == 0 {
					return nil, &apperror.SyntaxError{Position: t.pos, Reason: "unmatched ')'"}
				}
				top := stack[len(stack)-1]
				stack = stack[:len(stack)-1]
				if top.kind == tokLParen {
					break
				}
				output = append(output, top)
			}
			// A function call parenthesis carries its function out with it.
			if len(stack) > 0 && stack[len(stack)-1].kind == tokIdent {
				output = append(output, stack[len(stack)-1])
				stack = stack[:len(stack)-1]
			}

		case tokOperator:
			switch {
			case t.text == "%":
				// Postfix: binds tightest, so it never waits on the stack.
				if expectOperand {
					return nil, &apperror.SyntaxError{Position: t.pos, Reason: "unexpected '%'"}
				}
				output = append(output, t)

			case expectOperand && t.text == "-":
				// Prefix negation: pushed without popping — it cannot complete
				// a pending binary operator, its own operand has not arrived.
				stack = append(stack, token{kind: tokOperator, text: unaryMinus, pos: t.pos})

			case expectOperand:
				return nil, &apperror.SyntaxError{Position: t.pos, Reason: fmt.Sprintf("unexpected operator %q", t.text)}

			default:
				for len(stack) > 0 {
					top := stack[len(stack)-1]
					if top.kind != tokOperator {
						break
					}
					if precedence[top.text] > precedence[t.text] ||
						(precedence[top.text] == precedence[t.text] && !rightAssociative[t.text]) {
						output = append(output, top)
						stack = stack[:len(stack)-1]
						continue
					}
					break
				}
				stack = append(stack, t)
				expectOperand = true
			}
		}
	}

	if expectOperand || afterFunc {
		return nil, &apperror.SyntaxError{Position: inputLen, Reason: "unexpected end of expression"}
	}
	for len(stack) > 0 {
		top := stack[len(stack)-1]
		stack = stack[:len(stack)-1]
		if top.kind == tokLParen || top.kind == tokIdent {
			return nil, &apperror.SyntaxError{Position: top.pos, Reason: "unmatched '('"}
		}
		output = append(output, top)
	}
	return output, nil
}
