+++
title = ".NET’te Kod Kalitesini Zorunlu kılın: .editorconfig & Analyzers & Pre-Commit Hooks"
date = "2025-07-24T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = ["editorconfig","SonarAnalyzer","roslynator","pre-commit","TreatWarningsAsErrors"]
description = ".NET projelerinde kod kalitesini TreatWarningsAsErrors, .editorconfig, SonarAnalyzer, Roslynator ve pre-commit hook’ları kullanarak zorunlu kılın. Takım verimliliğini artırın, kod tutarlılığını sağlayın ve sağlam CI/CD süreçleri oluşturun."
showFullContent = false
readingTime = true
cover = "img/enforce-code-quality-in-net-editorconfig-analyzers-pre-commit-hooks/cover.jpg"
+++

Kod kalitesini korumak ve iyileştirmek yazdığımız her satırda hem kendimize hem de takım arkadaşlarımıza karşı bir sorumluluğumuz olarak düşünüyorum. Bu sorumluluğu uygularken kimi zaman acele yazılan kodlarla, yetişmesi gereken deadline’larla uygulanması gereken pratikleri göz ardı edebiliyoruz. Ayrıca, bu pratikleri takım arkadaşlarımıza yaygınlaştırırken de zorluklar yaşayabiliyoruz.

Bu tip sorunları aşıp, Kod kalitesini developer’ın inisiyatifine bırakmadan bir zorunluluk haline getirmenin birkaç adımdan oluşan ve 20+ developer’ın çalıştığı, 10+ servisten oluşan projeden çıkarılan deneyimlerle ispatlanan yöntemini paylaşmak istiyorum. 

İlk olarak TreatWarningsAsErrors flag’i ile projenin 1000+ warning ile production’a çıkmasını engelleyeceğiz.

Devamında .editorconfig dosyaları ile .NET tarafından default olarak sağlanan kurallarla örneğin property isimlendirmeleri takıma yaygınlaştırılması gereken genel-geçer bir kural değil bir zorunluluk haline getireceğiz.

Bu kuralları SonarAnalyzer ve Roslynator gibi paketlerle geliştirip, sonar taramalarına daha girmeden ilgili sorunları çözüp, daha performanslı ve güvenli kodlar yazacağız.

Son olarakta pre-commit hook ile, build olmayan projenin ve fail eden testlerin CI/CD pipelinelarında hataya sebep olmadan önce, daha commit atmadan bu testleri görüp, düzelteceğiz. Haydi başlayalım.

## TreatWarningsAsErrors ile warning içermeyen proje

.NET ile proje geliştirirken en çok warning “Possible null reference” ile ortaya çıkıyor. Bu warningle sınırlı olmadan projemizde birçok farklı warning ortaya çıkabilir ve bunlara saygı duymazsak runtime’da her yerde NullReferenceException almamız kadar doğal birşey olamaz.

Bu tip hatalar daha ortaya çıkmadan çözmek için Warning’lere Error olarak muamele edip, projenin build olmasını engelleyebiliriz. Bunun içinde .csproj dosyasına aşağıdaki flag’i eklememiz yeterlidir.

```xml
<PropertyGroup>
  <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  <!-- Sadece gerçekten gerekli ise -->
  <WarningsNotAsErrors>CS0108;NU1901;NU1902;NU1903;NU1904;NU1701</WarningsNotAsErrors>
</PropertyGroup>

```

Ancak bu flag ile .NET platformu tarafından verilen tüm Warning’ler Error olarak görüleceği için örneğin Nuget paketleri tarafından verilen ve bizim tarafımızca çözülemeyecek warningler başımızı çokça ağrıtabilir. Bu tür sorunların üstesinden gelmek içinde WarningsNotAsErrors flag’ini kullanabiliyoruz. Ancak bunu sadece çözülemez hatalar için yapmak önemli.

## .editorconfig ile projenin kurallarını belirleyelim

EditorConfig, aynı proje üzerinde çalışan birden fazla geliştiricinin farklı IDE'ler aracılığıyla tutarlı kodlama stilleri korumasına yardımcı olur. .NET projelerine özel bir pratik değildir, dil bağımsızdır ve ortak kuralları olduğu gibi dil özelinde kurallarıda mevcuttur. 

Bu sayede sınıflar [.NET](https://learn.microsoft.com/en-us/dotnet/fundamentals/code-analysis/categories) tarafından standart sağlanan kurallar ile örneğin PascalCase, değişkenler camelCase, sabitler LOWER_CASE olmalı gibi kuralları proje seviyesinde tanımlayabiliriz. 

Bu kurallara ek olarak [SonarAnalyzer](https://rules.sonarsource.com/csharp/) ile örneğin `name == “”` gibi facia bir kullanımı sonar taramasına girmeden yakalayıp `string.IsNullOrEmpty(name)` önerisini Visual Studio kullanıyorsanız Alt+Enter ile direk çözüm önerisini olarak alıp uygulayabilirsiniz. Bu sayede CI/CD adımında sonar taramasına giren kodunuz çok daha az hatayla taramaya başlayacaktır. 

Harika bir diğer code analyzer kütüphanesi olan [Roslynator](https://josefpihrt.github.io/docs/roslynator/) sayesinde de çok daha spesifik kuralları projemizde uygulayabiliriz. Örneğin class property’leri arasında bir boşluk olmalı gibi kod okunaklığını arttıran kuralları bu sayede uygulayabiliriz.

Bu tür third party analyzer kütüphanelerini repo içerisindeki tüm projelere uygulamak için her projeye tek tek uygulamaktansa root dizinde Directory.Build.Props isminde bir dosya oluşturup içeriğini aşağıdaki şekilde oluşturursak build adımında bu paketler tüm projelere otomatik eklenecektir.

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

Örnek olarak aşağıdaki .editorconfig dosyasına göz atabiliriz. Burada IDE ile tanımlanan kurallar .NET tarafından sağlanan standart kurallar, rcs ile başlayanlar roslynator ve S ile başlayanlar sonar kurallarıdır. Bu kurallar suggestion, warning ve error seviyesiyle tanımlanıp her bir proje için özelleştirilebilir.

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

Son olarak bu pratiklerle aşağıdaki gibi bir öneri alarak kodumuzun daha tutarlı ve okunaklı olmasını sağlayabiliyoruz.

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

Ayrıca GitHub'ın bol yıldızlı repolarında [dotnet / roslyn](https://github.com/dotnet/roslyn/blob/main/.editorconfig) ve [christianhelle / refitter](https://github.com/christianhelle/refitter/blob/main/.editorconfig) gibi .editorconfig referansları bulabilirsiniz.

## pre-commit hook ile sorunları lokalde yakalayalım

Pre-commit hook’lar, Git’in her commit’ten önce çalıştırdığı scriptlerdir. Kod formatlama, linting veya testlerin çalıştırılması gibi kontroller için oldukça uygundur, sorunlu kodların commitlenmesini engellerler. Testlerde hata alan bir kodu commitlemeyi engellemek kısa vadede sinir bozucu olsa da uzun vadede testleri canlı tutmak adına çok önemli. Eğer CI/CD pipeline’ınızda test adımı varsa o adıma gelmeden önce lokalde sorunları görmemizi sağlar.

.NET projelerinde bu pre-commit hook’larını register etmek için ek paketlerden yardım alınabilir veya manuel süreçler ile her developer’ın `git config core.hooksPath ./.git-hooks` komudunu çalıştırması istenebilir. Biz burada projemizi ek bir pakete bağımlı hale getirmeden .NET platformunun bize sağladığı yeteneklerden faydalanacağız.

`.csproj` dosyanıza aşağıdaki gibi ekleyeceğiniz basit bir MSBuild target’ı ile, her dotnet restore adımında, dolayısıylada build adımında Git hook dizininizin kurulmasını sağlayabilirsiniz. Böylece, projenizde çalışan kim olursa olsun, projeyi build ettiği sürece, ekstra adımlara gerek kalmadan pre-commit hook otomatik olarak yüklenecektir. Ayrıca Production ortamında bu adımı atlıyoruz, böylece CI/CD pipeline’larında ya da prod ortamlarda gereksiz kurulumlar yapılmıyor.

```xml
<Target Name="register git hooks" BeforeTargets="Restore;CollectPackageReferences" Condition="'$(ASPNETCORE_ENVIRONMENT)' != 'Production'">
    <Exec Command="git config core.hooksPath ./.git-hooks" StandardOutputImportance="Low" StandardErrorImportance="High" />
</Target>
```

Projenizin root dizininde `.git-hooks` adlı bir klasör oluşturun. İçine `pre-commit` isminde bir dosya oluşturun:

**`./git-hooks/pre-commit`**

```
#!/bin/sh

echo Running tests...
dotnet format
dotnet test

```

Dosyanızı çalıştırılabilir yapmayı unutmayın:

```bash
chmod +x .git-hooks/pre-commit

```

Bu akış sayesinde testlerin hata aldığı durumda commit atamayacağız

```bash
$  git commit -m 'failed commit'
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

Testler başarılı ise commit işlemi gerçekleşecektir:

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

## Özet

Özetle, .NET projelerinde kod kalitesini geliştirici insiyatifinden çıkarıp, takım genelinde zorunlu hale getirmek için uyguladığımız pratiklere göz attık. `TreatWarningsAsErrors`, .editorconfig kuralları ve gelişmiş analyzer paketleriyle kodun hem okunabilirliğini hem de güvenliğini arttırdık. Pre-commit hook’ları sayesinde ise hatalı veya testten geçmeyen kodun repoya girmesini baştan engelledik. Bu yaklaşımlarla, takımda sürdürülebilir ve yüksek kaliteli bir yazılım geliştirme kültürü oturtmak mümkün oldu.

Kaynak koduna erişmek isterseniz projenin tamamını GitHub hesabımda bulabilirsiniz:

[github.com/berkslv/lecture-net-pre-commit](https://github.com/berkslv/lecture-net-pre-commit)

## Kapanış

Okuduğunuz için teşekkürler! 🎉 Yazılım geliştirme alanındaki araştırmalarımı kaçırmamak için [@berkslv](https://x.com/berkslv) adresinden beni takip edebilirsiniz.