<?php
$filename = 'visits.txt';

$file_path = __DIR__ . '/' . $filename;

if (file_exists($file_path)) {
    $count = (int)file_get_contents($file_path);
} else {
    $count = 0; 
}

$count++;

file_put_contents($file_path, $count);

JSON
header('Content-Type: application/json');
echo json_encode(['visits' => $count]);
?>