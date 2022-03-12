+++
title = "400 satırlık türkçe kod yorumu 5 dakikada nasıl ingilizceye çevrilir? Bash Script kullanarak!"
slug = "400-satırlık-türkçe-kod-yorumu-5-dakikada-nasıl-ingilizceye-çevrilir-bash-script-kullanarak"
date = "2022-03-12T11:29:25+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
cover = "/img/how-to-translate-400-lines-of-code-comment-to-english-in-5-minutes-using-bash-scripts.jpg"
tags = ["bash", "bash script", "zsh", "automation"]
keywords = ["bash", "bash script", "zsh", "automation"]
description = "Bash'ın gücünü kullanarak parçalara dağılmış birden çok veriyi tek bir seferde nasıl güncelleyebiliriz buna değineceğiz."
showFullContent = false
readingTime = false
+++

Bilgisayar mühendisi olmanın belkide en zevkli kısmı büyük zaman alıcak fakat nitelik gerektirmeyen basit işleri yazılım ile otomatize etmektir. Bu yazımda kısaca 400 satırlık türkçe kod yorumu içeren projemdeki yorumları nasıl ingilizceye çevirdiğimi anlatacağım. 

Adı geçen [CollegeHub](https://github.com/college-hub) servis projem yakında GitHub üzerinden public olarak yayınlanacak. Geliştirme aşamasında kolaylık olması açısından kendi ana dilim olan türkçeyle kodları yorumlamıştım, ancak prensip olarak yazılım kaynak dosyasında ingilizce dışında bir dil kullanmak istemiyorum 😁.

# Hemen bunu nasıl yaptığıma geçelim.

IDE olarak VSC kullanıyorum ve kodlarımıda C# ile yazdım. İlk olarak adımları teker teker açıklayalım ve ayrıntılarına göz atalım:

1. "//" içeren satırlardaki yorumları bir txt dosyasına kopyaladım. 

2. Satır satır yorum içeren txt dosyasındaki içerikleri kopyalayıp Google Translate üzerinden makine çevirisi yaptım. 

3. Her bir dosyanın çevirisini ayrı olarak dosya dosya ele aldım.

4. Bash Script ile eşleşen kelimeleri ingilizceleri ile güncelledim.


## 1. Adım

`Ctrl+D` ile bir dosyadaki tüm "//" içeren yorumları seçip, kopyalayıp "translate.tr.txt" dosyasına yapıştırdım. Daha sonra Yorum işaretlerini temizledim. Elime aşağıdaki gibi bir dosya oluştu. Bu şekilde çeviri yapacağım tüm dosyaların yorumlarını tek bir dosyada topladım.

```txt
# translate.tr.txt

- AuthManager.cs
Kayıt işleminden önce validasyon yapılır.
Parola hashlenerek oluşturulur.
...

- CommentManager.cs
Verilen id ile Post döndürülür.
Post kontrol edilir. 
...

```

```txt
# translate.en.txt

- AuthManager.cs
Validation is done before registration.
It is created by hashing the password.
...

- CommentManager.cs
Post is returned with the given id.
The post is checked.
...

```


## 2. Adım

bu dosyada `Ctrl+A` ile hepsini seçip Google Translate üzerinden çeviri yaptım. Eğer bu txt dosyası çok uzunsa parça parçada bu çeviriyi yapabilirsiniz (ben öyle yaptım.).

## 3. Adım

Bash script'i çalıştırmak için her bir kod dosyasının çevirilerini ve orjinal hallerini iki ayrı dosyada tuttum. Kaynak dosyaları ile aynı konumda aşağıdaki üç dosyayı oluşturmuş oldum.

```txt

|- translate.AuthManager.en.txt
|- translate.AuthManager.tr.txt
|- replace.bash

```

## 4. Adım
   
En heyecanlı kısım olan bash script yazma kısmındayız. Ben bir Bash Script gurusu kesinlikle değilim, yalnızca ihtiyacım olabilecek kısmını google sayesinde öğreniyorum fakat yakın gelecekte bu konuda kendimi dahada geliştirmeyi düşünüyorum çünkü Bash Script ile file system üzerinde çok büyük esneklik kazanıyorsunuz. Aşağıdaki kod parçasını basit olarak açıklarsak;
   
İlk olarak dosya isimlerini içeren değişkenler tanımlanır, daha sonra `tr` dosyası için while loop açılır (satır sayısı kadar döner), while içerisinde `en` dosyasındaki eşlesen satırlar okunur (çevirilerin aynı satırlarda olmasına büyük dikkat gösterin.). Son olarakta `sed` komudunu kullanarak eşlesen text'ler güncellenir.

```bash
#!/bin/bash

# Assign the filenames
filename="AuthManager.cs"
filenameTR="translate.AuthManager.tr.txt"
filenameEN="translate.AuthManager.en.txt"

# initalize while loop
n=1
# reading each line
while read line; do
# assign tr file line-by-line to search variable
search=$line
# assign en file line-by-line to replace variable
replace=$(sed "$n q;d" $filenameEN)

# check if search and replace null
if [[ $search != "" && $replace != "" ]]; then
# replace all matching texts.
sed -i '' "s/$search/$replace/" $filename
fi

n=$((n+1))
done < $filenameTR

```

--- 

## Son söz

Vakit ayırdığınız için çok teşekkür ederim. Eğer bu içeriği değerli buluyorsanız kısa bir yorum ile belirtebilirsiniz. 🥳