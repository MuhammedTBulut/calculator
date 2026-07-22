package calculator_test

import (
	"math"
	"testing"

	"pgregory.net/rapid"
)

// approxEqual compares with a relative tolerance; exact float equality is the
// wrong tool once two rounding steps are involved.
func approxEqual(a, b float64) bool {
	if a == b {
		return true
	}
	return math.Abs(a-b) <= 1e-9*math.Max(math.Abs(a), math.Abs(b))
}

func TestAddIsCommutative(t *testing.T) {
	reg := newRegistry(t)
	rapid.Check(t, func(rt *rapid.T) {
		x := rapid.Float64().Draw(rt, "x")
		y := rapid.Float64().Draw(rt, "y")
		a, errA := reg.Execute("add", x, y)
		b, errB := reg.Execute("add", y, x)
		// Both orders must agree on the outcome — value or error alike
		// (IEEE 754 addition is commutative; overflow is symmetric).
		if (errA == nil) != (errB == nil) {
			t.Fatalf("add(%g,%g) err=%v but add(%g,%g) err=%v", x, y, errA, y, x, errB)
		}
		if errA == nil && a != b {
			t.Fatalf("add(%g,%g)=%g but add(%g,%g)=%g", x, y, a, y, x, b)
		}
	})
}

func TestMultiplyIsCommutative(t *testing.T) {
	reg := newRegistry(t)
	rapid.Check(t, func(rt *rapid.T) {
		x := rapid.Float64().Draw(rt, "x")
		y := rapid.Float64().Draw(rt, "y")
		a, errA := reg.Execute("multiply", x, y)
		b, errB := reg.Execute("multiply", y, x)
		if (errA == nil) != (errB == nil) {
			t.Fatalf("multiply(%g,%g) err=%v but multiply(%g,%g) err=%v", x, y, errA, y, x, errB)
		}
		if errA == nil && a != b {
			t.Fatalf("multiply(%g,%g)=%g but multiply(%g,%g)=%g", x, y, a, y, x, b)
		}
	})
}

func TestSubtractSelfIsZero(t *testing.T) {
	reg := newRegistry(t)
	rapid.Check(t, func(rt *rapid.T) {
		x := rapid.Float64().Draw(rt, "x")
		got, err := reg.Execute("subtract", x, x)
		if err != nil {
			t.Fatalf("subtract(%g,%g) unexpected error: %v", x, x, err)
		}
		if got != 0 {
			t.Fatalf("subtract(%g,%g) = %g, want 0", x, x, got)
		}
	})
}

func TestDivideMultiplyRoundTrip(t *testing.T) {
	reg := newRegistry(t)
	// Magnitudes are bounded so neither the quotient nor the product can
	// overflow or underflow — the property under test is inversion, not
	// float64 range behavior (that is covered by the table tests).
	genX := rapid.Float64Range(-1e150, 1e150).
		Filter(func(v float64) bool { return v == 0 || math.Abs(v) >= 1e-100 })
	genY := rapid.Float64Range(-1e100, 1e100).
		Filter(func(v float64) bool { return math.Abs(v) >= 1e-100 })

	rapid.Check(t, func(rt *rapid.T) {
		x := genX.Draw(rt, "x")
		y := genY.Draw(rt, "y")
		q, err := reg.Execute("divide", x, y)
		if err != nil {
			t.Fatalf("divide(%g,%g) unexpected error: %v", x, y, err)
		}
		back, err := reg.Execute("multiply", q, y)
		if err != nil {
			t.Fatalf("multiply(%g,%g) unexpected error: %v", q, y, err)
		}
		if !approxEqual(back, x) {
			t.Fatalf("divide(%g,%g)*%g = %g, want ≈ %g", x, y, y, back, x)
		}
	})
}
