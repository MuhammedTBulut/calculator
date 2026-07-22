package apperror_test

import (
	"errors"
	"fmt"
	"testing"

	"github.com/MuhammedTBulut/calculator/backend/internal/apperror"
)

// Every layer matches these with errors.Is, so the wrapping contract matters
// more than the messages.
func TestSentinelsAreDistinct(t *testing.T) {
	sentinels := []error{
		apperror.ErrDivisionByZero, apperror.ErrNegativeSqrt,
		apperror.ErrInvalidOperand, apperror.ErrOverflow,
		apperror.ErrArityMismatch, apperror.ErrUnknownOperation,
		apperror.ErrSyntax, apperror.ErrUnknownFunction,
	}
	for i, a := range sentinels {
		for j, b := range sentinels {
			if i != j && errors.Is(a, b) {
				t.Fatalf("sentinel %v matches unrelated sentinel %v", a, b)
			}
		}
	}
}

func TestSentinelsSurviveWrapping(t *testing.T) {
	wrapped := fmt.Errorf("evaluate %q: %w", "1/0", apperror.ErrDivisionByZero)
	if !errors.Is(wrapped, apperror.ErrDivisionByZero) {
		t.Fatal("wrapped sentinel no longer matches with errors.Is")
	}
	if errors.Is(wrapped, apperror.ErrOverflow) {
		t.Fatal("wrapped sentinel matches an unrelated sentinel")
	}
}

func TestSyntaxErrorCarriesPositionAndUnwrapsToErrSyntax(t *testing.T) {
	err := error(&apperror.SyntaxError{Position: 4, Reason: `unexpected ")"`})

	if !errors.Is(err, apperror.ErrSyntax) {
		t.Fatal("SyntaxError does not unwrap to ErrSyntax")
	}

	var syn *apperror.SyntaxError
	if !errors.As(err, &syn) {
		t.Fatal("errors.As could not extract *SyntaxError")
	}
	if syn.Position != 4 {
		t.Fatalf("Position = %d, want 4", syn.Position)
	}

	want := `syntax error at position 4: unexpected ")"`
	if got := err.Error(); got != want {
		t.Fatalf("Error() = %q, want %q", got, want)
	}

	// The type must stay extractable through wrapping — the adapter relies on
	// it to report the byte position.
	if !errors.As(fmt.Errorf("evaluate: %w", err), &syn) {
		t.Fatal("wrapped SyntaxError is not extractable with errors.As")
	}
}
