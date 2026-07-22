// Package internal_test enforces the architectural boundaries CLAUDE.md
// declares, so "the domain core never imports transport" is a failing test
// rather than a claim in a document.
package internal_test

import (
	"go/build"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

const modulePath = "github.com/MuhammedTBulut/calculator/backend"

// TestDomainImportBoundaries is the named enforcement mechanism for the
// dependency rules: the domain core must not reach outward to transport, and
// nothing may depend on the inbound adapter.
//
// go/build is used rather than a raw AST walk because it applies build
// constraints and separates production imports from test imports — a test
// helper importing net/http is legitimate, production domain code is not.
func TestDomainImportBoundaries(t *testing.T) {
	tests := []struct {
		pkg       string
		forbidden []string
		why       string
	}{
		{
			pkg:       "internal/calculator",
			forbidden: []string{"net/http", "encoding/json", modulePath + "/internal/api", modulePath + "/internal/parser"},
			why:       "the domain core must not know about transport, JSON, the adapter, or the layer above it",
		},
		{
			pkg:       "internal/parser",
			forbidden: []string{"net/http", "encoding/json", modulePath + "/internal/api"},
			why:       "the parser must not know about transport, JSON, or the adapter",
		},
		{
			pkg:       "internal/apperror",
			forbidden: []string{"net/http", "encoding/json", modulePath + "/internal/api", modulePath + "/internal/parser", modulePath + "/internal/calculator"},
			why:       "the shared error taxonomy must stay depended-upon, never depending",
		},
	}

	for _, tc := range tests {
		t.Run(tc.pkg, func(t *testing.T) {
			for _, imp := range productionImports(t, tc.pkg) {
				if slices.Contains(tc.forbidden, imp) {
					t.Errorf("%s imports %q: %s", tc.pkg, imp, tc.why)
				}
			}
		})
	}
}

// TestNothingDependsOnTheAdapter pins the direction of the one-way boundary:
// internal/api is an inbound adapter, so no other package may import it.
func TestNothingDependsOnTheAdapter(t *testing.T) {
	// cmd/server is the composition root and is expected to import everything.
	for _, pkg := range []string{"internal/calculator", "internal/parser", "internal/apperror"} {
		for _, imp := range productionImports(t, pkg) {
			if imp == modulePath+"/internal/api" {
				t.Errorf("%s imports the inbound adapter; the dependency must point the other way", pkg)
			}
		}
	}
}

// TestDomainCarriesNoJSONTags keeps DTOs at the boundary: a `json:` tag in a
// domain package means a wire format has leaked into the core.
func TestDomainCarriesNoJSONTags(t *testing.T) {
	for _, pkg := range []string{"internal/calculator", "internal/parser", "internal/apperror"} {
		for _, file := range productionFiles(t, pkg) {
			if content := readFile(t, file); strings.Contains(content, "json:\"") {
				t.Errorf("%s carries a json struct tag; domain types must not describe the wire format", file)
			}
		}
	}
}

// productionImports returns the non-test imports of a package in this module.
func productionImports(t *testing.T, pkg string) []string {
	t.Helper()
	return importPackage(t, pkg).Imports
}

func productionFiles(t *testing.T, pkg string) []string {
	t.Helper()
	p := importPackage(t, pkg)
	files := make([]string, 0, len(p.GoFiles))
	for _, name := range p.GoFiles {
		files = append(files, filepath.Join(p.Dir, name))
	}
	return files
}

func importPackage(t *testing.T, pkg string) *build.Package {
	t.Helper()
	// Tests run in this file's directory (backend/internal), so package
	// directories resolve one level down.
	dir, err := filepath.Abs(filepath.Join("..", pkg))
	if err != nil {
		t.Fatalf("resolve %s: %v", pkg, err)
	}
	p, err := build.ImportDir(dir, 0)
	if err != nil {
		t.Fatalf("import %s: %v", pkg, err)
	}
	return p
}

func readFile(t *testing.T, path string) string {
	t.Helper()
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(b)
}
