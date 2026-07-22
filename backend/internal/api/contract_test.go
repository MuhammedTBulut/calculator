package api_test

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/getkin/kin-openapi/routers"
	"github.com/getkin/kin-openapi/routers/gorillamux"
)

// The OpenAPI document is a tested artifact: every response recorded by this
// suite is validated against docs/openapi.yaml, so code and spec cannot
// silently diverge (this is the one permitted third-party test dependency).
var (
	specOnce   sync.Once
	specRouter routers.Router
	specErr    error
)

func loadSpec() {
	loader := openapi3.NewLoader()
	doc, err := loader.LoadFromFile("../../../docs/openapi.yaml")
	if err != nil {
		specErr = err
		return
	}
	if err := doc.Validate(loader.Context); err != nil {
		specErr = err
		return
	}
	specRouter, specErr = gorillamux.NewRouter(doc)
}

// do serves one request against the handler and validates the recorded
// response (status, headers, body shape) against the OpenAPI contract.
// OPTIONS preflights are exempt: CORS is a browser protocol, not part of the
// documented API surface.
func do(t *testing.T, h http.Handler, req *http.Request) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if req.Method == http.MethodOptions {
		return rec
	}

	specOnce.Do(loadSpec)
	if specErr != nil {
		t.Fatalf("load docs/openapi.yaml: %v", specErr)
	}
	route, pathParams, err := specRouter.FindRoute(req)
	if err != nil {
		t.Fatalf("%s %s is not in docs/openapi.yaml: %v", req.Method, req.URL.Path, err)
	}
	input := &openapi3filter.ResponseValidationInput{
		RequestValidationInput: &openapi3filter.RequestValidationInput{
			Request:    req,
			PathParams: pathParams,
			Route:      route,
		},
		Status: rec.Code,
		Header: rec.Header(),
		// Without this, kin-openapi silently passes statuses the spec does
		// not document (checkpoint-3 finding). Requests are deliberately NOT
		// validated: this suite sends intentionally invalid bodies to
		// exercise the 400 branches, and those must not fail as spec
		// violations — the contract's enforcement direction is responses.
		Options: &openapi3filter.Options{IncludeResponseStatus: true},
	}
	input.SetBodyBytes(rec.Body.Bytes())
	if err := openapi3filter.ValidateResponse(context.Background(), input); err != nil {
		t.Fatalf("%s %s response violates docs/openapi.yaml: %v\nbody: %s",
			req.Method, req.URL.Path, err, rec.Body.String())
	}
	return rec
}

func jsonRequest(method, path, body string) *http.Request {
	var r io.Reader
	if body != "" {
		r = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, r)
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	return req
}
