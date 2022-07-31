+++
title = "How to translate 400 lines of code comment to English in 5 minutes? Using Bash Scripts!"
slug = "how-to-translate-400-lines-of-code-comment-to-english-in-5-minutes-using-bash-scripts"
date = "2022-03-12T11:29:25+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
cover = "/img/how-to-translate-400-lines-of-code-comment-to-english-in-5-minutes-using-bash-scripts.jpg"
tags = ["bash", "bash script", "zsh", "automation"]
keywords = ["bash", "bash script", "zsh", "automation"]
description = "We'll cover how to update multiple pieces of data at once using the power of Bash."
showFullContent = false
readingTime = false
+++

Perhaps the most enjoyable part of being a computer engineer is automating simple tasks that will take a lot of time but do not require qualifications. In this article, I will briefly explain how I translated the comments in my project, which includes 400 lines of Turkish code comments, into English.

My [CollegeHub](https://github.com/college-hub) service project will be publicly released on GitHub very soon. I wrote the docs in Turkish, which is my native language, for convenience during the development phase, but in principle, I do not want to use a language other than English in the software source file 😁.

# Let's jump right into how I do this.

I use VSC as IDE and I wrote my codes in C#. First, let's explain the steps one by one and take a look at the details:

1. I copied the comments on lines containing "//" into a txt file.

2. I copied the contents of the txt file containing line-by-line comments and made a machine translation using Google Translate.

3. I handled the translation of each file separately, file by file.

4. I updated the words matching the Bash Script with their English.


## Step 1

I selected all the comments containing "//" in a file with `Ctrl+D`, copied and pasted them into the "translate.tr.txt" file. I then cleared the Comment marks. I have a file like below. In this way, I gathered the comments of all the files that I will translate in a single file.

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

## Step 2

In this file, I selected all of them with `Ctrl+A` and translated them via Google Translate. If this txt file is too long, you can do this translation piece by piece (that's how I did it.).

## Step 3

To run the bash script, I kept the translations and original versions of each script files in two separate files. I have created the following three files in the same location as the source files.

```txt

|- translate.AuthManager.en.txt
|- translate.AuthManager.tr.txt
|- replace.bash

```

## Step 4
   
We are at the most exciting part, bash script writing. I am definitely not a Bash Script guru, I only learn the part that I may need thanks to Google, but I plan to improve myself in this subject in the near future because with Bash Script you gain a lot of flexibility on the file system. If we explain the following piece of code simply;
   
First, the variables containing the filenames are defined, then the while loop is opened for the file `tr` (The loop repeats the number of rows.), while in the while the matching lines in the file `en` are read (take care that the translations are on the same lines.). Finally, the matching texts are updated using the `sed` command.

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

## Last word

Thank you very much for your time. If you find this content valuable, you can specify it with a short comment. 🥳
