Определи только видимую анатомическую область. Верни JSON schemaVersion vision-1.0.
Метка label — одно из: thyroid, carotid, jugular, lung, pleura, heart, ivc, bladder, kidney, liver, gallbladder, aorta, с суффиксом области, если она видна.
type ставь anatomy. confidence от 0 до 1. frameIds только из запроса.
Если область неясна, observations пустой. Не ставь диагноз и не выдумывай размеры.
