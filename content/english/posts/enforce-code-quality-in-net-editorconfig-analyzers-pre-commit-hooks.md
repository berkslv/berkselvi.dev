+++
title = "Enforce Code Quality in .NET: .editorconfig & Analyzers & Pre-Commit Hooks"
date = "2025-07-13T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = ["editorconfig","SonarAnalyzer","roslynator","pre-commit","TreatWarningsAsErrors"]
description = "Enforce code quality in .NET projects using TreatWarningsAsErrors, .editorconfig, SonarAnalyzer, Roslynator, and pre-commit hooks. Improve team productivity, code consistency, and build robust CI/CD pipelines."
showFullContent = false
readingTime = true
cover = "img/enforce-code-quality-in-net-editorconfig-analyzers-pre-commit-hooks/cover.jpg"
+++

I believe that maintaining and improving code quality is a responsibility we owe both to ourselves and to our teammates with every line of code we write. However, in practice, we sometimes overlook best practices due to hastily written code or tight deadlines. Additionally, we often face challenges when trying to spread these practices across our teams.

To overcome such problems and to make code quality a requirement, rather than something left to individual developer discretion, I’d like to share a multi-step approach, proven by experience in a project with 20+ developers and 10+ services.

First, we'll use the TreatWarningsAsErrors flag to prevent the project from being released to production with 1000+ warnings.

Then, with .editorconfig files, rules that .NET provides by default, such as property naming conventions, will become not just a guideline, but an enforced rule across the team.

We'll further strengthen these rules using packages like SonarAnalyzer and Roslynator, allowing us to resolve issues before even running sonar scans, leading to more performant and secure code.

Finally, with a pre-commit hook, we'll catch unbuildable projects and failing tests before they even reach CI/CD pipelines, allowing us to see and fix these issues before committing. Let's get started.

## Warning-Free Project with TreatWarningsAsErrors

When developing a project with .NET, the most common warning is "Possible null reference." Of course, there can be many other warnings in our project. If we ignore them, it’s only natural to encounter NullReferenceExceptions everywhere at runtime.

To resolve such errors before they even surface, we can treat warnings as errors and prevent the project from building if they exist. To do this, simply add the following flag to your .csproj file:

```xml
<PropertyGroup>
  <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  <!-- Only if absolutely necessary -->
  <WarningsNotAsErrors>CS0108;NU1901;NU1902;NU1903;NU1904;NU1701</WarningsNotAsErrors>
</PropertyGroup>

```

However, since this flag treats all warnings from the .NET platform as errors, some warnings, like those from Nuget packages that you can't resolve yourself, can become a real headache. To address such issues, you can use the WarningsNotAsErrors flag, but only for errors you truly cannot fix.

## Set Project Rules with .editorconfig

EditorConfig helps developers working on the same project maintain consistent coding styles across different IDEs. It’s not exclusive to .NET projects, it’s language-agnostic and includes both general and language-specific rules.

With this, you can set project-level rules such as classes following PascalCase, variables using camelCase, and constants in LOWER_CASE all based on .NET’s [standard guidelines](https://learn.microsoft.com/en-us/dotnet/fundamentals/code-analysis/categories).

In addition, using [SonarAnalyzer](https://rules.sonarsource.com/csharp/), you can catch problematic code like `name == ""` (a disaster in code!) before it ever reaches a sonar scan, and get an instant suggestion (e.g., use `string.IsNullOrEmpty(name)`) with Alt+Enter in Visual Studio. This way, your code will enter the CI/CD sonar scan step with far fewer issues.

Another great code analyzer library, [Roslynator](https://josefpihrt.github.io/docs/roslynator/), lets you enforce more specific rules in your project, like requiring a blank line between class properties, which boosts code readability.

Instead of adding these third-party analyzer packages to each project individually, you can create a `Directory.Build.Props` file in your repo's root directory with the following content. This will automatically include the packages in all projects during the build step:

```xml
<Project>
  <ItemGroup>
    <PackageReference
      Include="Roslynator.Analyzers"
      Version="4.12.4"
      PrivateAssets="all"
      Condition="$(MSBuildProjectExtension) == '.csproj'"
    />
    <PackageReference
      Include="Roslynator.Formatting.Analyzers"
      Version="4.12.4"
      PrivateAssets="all"
      Condition="$(MSBuildProjectExtension) == '.csproj'"
    />
    <PackageReference
      Include="SonarAnalyzer.CSharp"
      Version="9.32.0.97167"
      PrivateAssets="all"
      Condition="$(MSBuildProjectExtension) == '.csproj'"
    />
  </ItemGroup>
</Project>

```

Here’s a sample .editorconfig file. The rules defined by the `IDE` are standard .NET rules; those starting with `rcs` come from Roslynator; those starting with `S` are Sonar rules. These rules can be defined as suggestion, warning, or error, and can be customized for each project.

```bash
# top-most EditorConfig file
root = true

# Don't use tabs for indentation.
[*]
indent_style = space
# (Please don't specify an indent_size here; that has too many unintended consequences.)
spelling_exclusion_path = SpellingExclusions.dic

# Code files
[*.{cs,csx,vb,vbx}]
indent_size = 4
insert_final_newline = true
charset = utf-8-bom

# XML project files
[*.{csproj,vbproj,vcxproj,vcxproj.filters,proj,projitems,shproj}]
indent_size = 2

# XML config files
[*.{props,targets,ruleset,config,nuspec,resx,vsixmanifest,vsct}]
indent_size = 2

# JSON files
[*.json]
indent_size = 2

# Powershell files
[*.ps1]
indent_size = 2

# Shell script files
[*.sh]
end_of_line = lf
indent_size = 2

# Dotnet code style settings:
[*.{cs,vb}]

# Sort using and Import directives with System.* appearing first
dotnet_sort_system_directives_first = true
dotnet_separate_import_directive_groups = false

# IDE0005: Remove unnecessary using directives
dotnet_diagnostic.IDE0005.severity = warning

# IDE0010: Add missing cases to switch statement
dotnet_diagnostic.IDE0010.severity = warning

# Add blank line after using directive list
dotnet_diagnostic.rcs0003.severity = error

# Place new line after/before '?:' operator
dotnet_diagnostic.rcs0028.severity = error

# Track uses of "TODO" tags
dotnet_diagnostic.S1135.severity = suggestion

```

Finally, with these practices, we can make our code more consistent and readable by getting a suggestion like the one below.

```bash
csharp_prefer_braces = true:suggestion
```

```csharp
// Good:
if (isActive)
{
    DoSomething();
}

// Bad:
if (isActive)
    DoSomething();
```

## Catch Issues Locally with pre-commit Hooks

Pre-commit hooks are scripts that Git runs before every commit. They’re great for checks like code formatting, linting, or running tests, and they prevent problematic code from being committed. Blocking commits that fail tests can be annoying in the short term, but it’s crucial for keeping your tests reliable in the long run. If you have a test step in your CI/CD pipeline, this lets you see and fix issues locally before they ever reach that step.

In .NET projects, you can set up these pre-commit hooks with helper packages, or you can ask every developer to run `git config core.hooksPath ./.git-hooks` manually. Here, we'll leverage .NET’s built-in capabilities without relying on extra packages.

Add a simple MSBuild target like the one below to your `.csproj` file. This ensures that your Git hook directory is set up during every `dotnet restore` (and thus build) step, so anyone working on your project gets the pre-commit hook set up automatically. We skip this step in Production to avoid unnecessary installs in CI/CD or production environments.

```xml
<Target Name="register git hooks" BeforeTargets="Restore;CollectPackageReferences" Condition="'$(ASPNETCORE_ENVIRONMENT)' != 'Production'">
    <Exec Command="git config core.hooksPath ./.git-hooks" StandardOutputImportance="Low" StandardErrorImportance="High" />
</Target>

```

Create a folder called `.git-hooks` in your project's root directory. Inside, create a file named `pre-commit`:

**`./git-hooks/pre-commit`**

```
#!/bin/sh

echo Running tests...
dotnet format
dotnet test

```

Don’t forget to make your file executable:

```bash
chmod +x .git-hooks/pre-commit

```

With this setup, you won’t be able to commit if your tests fail:

```bash
$ git commit -m 'failed commit'
Running tests...
  Determining projects to restore...
  All projects are up-to-date for restore.
  Committer.API -> C:\Projects\Personal\lecture-net-pre-commit\src\Committer.API\bin\Debug\net9.0\Committer.API.dll
  Committer.Tests -> C:\Projects\Personal\lecture-net-pre-commit\tests\Committer.Tests\bin\Debug\net9.0\Committer.Tests.dll
Test run for C:\Projects\Personal\lecture-net-pre-commit\tests\Committer.Tests\bin\Debug\net9.0\Committer.Tests.dll (.NETCoreApp,Version=v9.0)
VSTest version 17.14.0 (x64)

Starting test execution, please wait...
A total of 1 test files matched the specified pattern.
[xUnit.net 00:00:00.14]     Committer.Tests.Services.CalculatorServiceTests.Add_ShouldReturnCorrectSum(a: 5, b: 3, expected: 7) [FAIL]
  Failed Committer.Tests.Services.CalculatorServiceTests.Add_ShouldReturnCorrectSum(a: 5, b: 3, expected: 7) [1 ms]
  Error Message:
   Assert.Equal() Failure: Values differ
Expected: 7
Actual:   8
  Stack Trace:
     at Committer.Tests.Services.CalculatorServiceTests.Add_ShouldReturnCorrectSum(Double a, Double b, Double expected) in C:\Projects\Personal\lecture-net-pre-commit\tests\Committer.Tests\Services\CalculatorServiceTests.cs:line 25
   at InvokeStub_CalculatorServiceTests.Add_ShouldReturnCorrectSum(Object, Span`1)
   at System.Reflection.MethodBaseInvoker.InvokeWithFewArgs(Object obj, BindingFlags invokeAttr, Binder binder, Object[] parameters, CultureInfo culture)

Failed!  - Failed:     1, Passed:    18, Skipped:     0, Total:    19, Duration: 39 ms - Committer.Tests.dll (net9.0)

$ git log --oneline
9a89b16 (HEAD -> main, origin/main) test commit
10367df README.md added
0051724 Inital commit

```

If your tests pass, the commit will go through:

```bash
$ git commit -m 'succeded commit'
Running tests...
  Determining projects to restore...
  All projects are up-to-date for restore.
  Committer.API -> C:\Projects\Personal\lecture-net-pre-commit\src\Committer.API\bin\Debug\net9.0\Committer.API.dll
  Committer.Tests -> C:\Projects\Personal\lecture-net-pre-commit\tests\Committer.Tests\bin\Debug\net9.0\Committer.Tests.dll
Test run for C:\Projects\Personal\lecture-net-pre-commit\tests\Committer.Tests\bin\Debug\net9.0\Committer.Tests.dll (.NETCoreApp,Version=v9.0)
VSTest version 17.14.0 (x64)

Starting test execution, please wait...
A total of 1 test files matched the specified pattern.

Passed!  - Failed:     0, Passed:    19, Skipped:     0, Total:    19, Duration: 31 ms - Committer.Tests.dll (net9.0)
[main 0d9f3cf] succeded commit
 1 file changed, 1 insertion(+), 1 deletion(-)

$ git log --oneline
0d9f3cf (HEAD -> main) succeded commit
9a89b16 (origin/main) test commit
10367df README.md added
0051724 Inital commit

```

---

## Summary

In summary, we’ve looked at practices for making code quality a team-wide requirement in .NET projects, rather than leaving it to individual developer initiative. With TreatWarningsAsErrors, .editorconfig rules, and advanced analyzer packages, we increased both the readability and security of our code. Pre-commit hooks allowed us to block problematic or failing code from ever entering the repo. With these approaches, we established a sustainable, high-quality software development culture within the team.

If you'd like access to the source code, you can find the full project on my GitHub:

[github.com/berkslv/lecture-net-pre-commit](https://github.com/berkslv/lecture-net-pre-commit)

---

## Conclusion

Thank you for reading! 🎉 To stay updated with my research in software development, you can follow me at [@berkslv](https://x.com/berkslv).