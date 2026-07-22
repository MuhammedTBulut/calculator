package parser_test

import "testing"

// BenchmarkEvaluate measures one representative expression end to end
// (tokenize → RPN → registry-delegated evaluation). Its output is quoted in
// the README — measured claims only.
func BenchmarkEvaluate(b *testing.B) {
	eval := newEvaluator(b)
	b.ReportAllocs()
	for b.Loop() {
		if _, err := eval.Evaluate("(2+3)*sqrt(16)-4^2"); err != nil {
			b.Fatal(err)
		}
	}
}
