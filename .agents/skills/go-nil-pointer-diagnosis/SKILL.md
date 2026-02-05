# Go Nil Pointer Exception Diagnosis

Diagnose and fix nil pointer dereference panics in Go code.

## When to Use
- User encounters `panic: runtime error: invalid memory address or nil pointer dereference`
- User asks about nil pointer issues, segfaults, or crashes in Go code
- Debugging unexpected panics in Go applications

## Diagnosis Steps

### 1. Identify the panic location
Get the stack trace. The first non-runtime frame shows where the nil dereference occurred.

### 2. Check common nil pointer sources

**Uninitialized struct fields:**
```go
type Service struct {
    client *http.Client  // nil if not initialized
}
s := &Service{}
s.client.Do(req)  // panic
```

**Map access returning zero value:**
```go
m := map[string]*User{}
user := m["unknown"]  // returns nil, not error
user.Name  // panic
```

**Interface nil vs typed nil:**
```go
var p *MyStruct = nil
var i interface{} = p
if i != nil {  // true! typed nil != interface nil
    i.(*MyStruct).Method()  // panic
}
```

**Slice/array out of bounds returning nil:**
```go
var users []*User
if len(users) > 0 {
    users[0].Name  // safe
}
users[0].Name  // panic if empty
```

**Failed type assertions:**
```go
val := someInterface.(*ConcreteType)  // panic if wrong type
// Use comma-ok instead:
val, ok := someInterface.(*ConcreteType)
```

**Deferred function with nil receiver:**
```go
var f *os.File
defer f.Close()  // panic when deferred runs
```

**Goroutine capturing nil:**
```go
var svc *Service
go func() {
    svc.Run()  // may be nil when goroutine executes
}()
```

**Error handling that ignores error:**
```go
result, err := SomeFunc()
// Missing: if err != nil { return }
result.DoSomething()  // result may be nil when err != nil
```

**JSON/DB unmarshaling into pointer field:**
```go
type Response struct {
    Data *Payload `json:"data"`
}
var r Response
json.Unmarshal(data, &r)
r.Data.Field  // panic if "data" was null/missing
```

**Context value retrieval:**
```go
val := ctx.Value(key).(*MyType)  // panic if key not set
```

### 3. Search patterns to find issues

Look for these patterns near the panic location:
- Struct field access without nil check: `\.Field` or `\.Method\(`
- Map access: `\[.*\]\.` 
- Type assertions without comma-ok: `\.\([^)]+\)[^,]`
- Missing error checks: `_, err :=` followed by no `if err`

### 4. Recommended fixes

**Add nil guards:**
```go
if obj != nil {
    obj.Method()
}
```

**Use comma-ok for maps and type assertions:**
```go
if val, ok := m[key]; ok {
    val.Method()
}
```

**Initialize structs properly:**
```go
func NewService() *Service {
    return &Service{
        client: &http.Client{},
    }
}
```

**Return early on errors:**
```go
result, err := Func()
if err != nil {
    return nil, err
}
return result.Process(), nil
```

## Debugging Commands

```bash
# Run with race detector (catches some nil issues)
go run -race .

# Get verbose panic output
GOTRACEBACK=all go run .

# Use delve debugger
dlv debug -- [args]
```
